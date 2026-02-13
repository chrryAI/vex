"use client"

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  SetStateAction,
  createContext,
  useContext,
  useMemo,
} from "react"
import type { ReactElement, ReactNode } from "react"

import { isSameDay, FRONTEND_URL, apiFetch, API_URL } from "../utils"
import { device, timer } from "../types"
import console from "../utils/log"

import useSWR from "swr"
import { useWebSocket } from "../hooks/useWebSocket"
import { useAuth } from "./providers"
import { useLocalStorage, usePlatform, useTheme, Audio } from "../platform"

export const STORAGE_SELECTED_TASKS_KEY = "selectedTasks"

export const TimerContext = createContext<{
  fetchTimer: () => Promise<void>
  selectedTasks: Task[] | undefined
  setSelectedTasks: (value: Task[] | undefined) => void
  presetMin1: number
  presetMin2: number
  presetMin3: number
  setPresetMin1: (value: number) => void
  setPresetMin2: (value: number) => void
  setPresetMin3: (value: number) => void
  playKitasaku?: boolean
  setPlayKitasaku: (playKitasaku: boolean) => void
  stopAdjustment: () => void
  startAdjustment: (direction: number, isMinutes: boolean) => void
  playTimerEnd: () => void
  updateTimer: (data: timer) => void
  isCancelled: boolean

  remoteTimer: timer | null
  timer: timer | null
  setTimer: (timer: timer | null) => void

  tasks?: {
    tasks: Task[]
    totalCount: number
    hasNextPage: boolean
    nextPage: number | null
  }
  setTasks: (
    tasks: SetStateAction<
      | {
          tasks: Task[]
          totalCount: number
          hasNextPage: boolean
          nextPage: number | null
        }
      | undefined
    >,
  ) => void
  handlePresetTime: (minutes: number) => void
  isLoadingTasks: boolean
  playBirds?: boolean
  setPlayBirds: (playBirds: boolean) => void
  activePomodoro: number | null
  setActivePomodoro: (activePomodoro: number | null) => void
  time: number
  isCountingDown: boolean
  isPaused: boolean
  isFinished: boolean
  startTime: number
  setIsCountingDown: (isCountingDown: boolean) => void
  setIsPaused: (isPaused: boolean) => void
  setTime: (time: number) => void
  setIsFinished: (isFinished: boolean) => void
  startCountdown: (duration?: number) => void
  setStartTime: (startTime: number) => void
  fetchTasks: () => Promise<void>
  handleCancel: () => void
  replay: boolean
  setReplay: (replay: boolean) => void
  handlePause: () => void
  handleResume: () => void
}>({
  isCancelled: false,
  remoteTimer: null,
  timer: null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setTimer: (_timer: timer | null) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateTimer: (_data: timer) => {},
  selectedTasks: undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setSelectedTasks: (_tasks: Task[] | undefined) => {},
  presetMin1: 25,
  presetMin2: 15,
  presetMin3: 5,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPresetMin1: (_value: number) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPresetMin2: (_value: number) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPresetMin3: (_value: number) => {},
  handlePause: () => {},
  handleResume: () => {},
  playKitasaku: false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPlayKitasaku: (_playKitasaku: boolean) => {},
  stopAdjustment: () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startAdjustment: (_direction: number, _isMinutes: boolean) => {},
  playTimerEnd: () => {},
  fetchTasks: async () => {},
  fetchTimer: async () => {},
  isLoadingTasks: false,
  playBirds: false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPlayBirds: (_playBirds: boolean) => {},
  activePomodoro: null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setActivePomodoro: (_activePomodoro: number | null) => {},
  time: 0,
  isCountingDown: false,
  isPaused: false,
  isFinished: false,
  startTime: 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setIsCountingDown: (_isCountingDown: boolean) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setIsPaused: (_isPaused: boolean) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setTime: (_time: number) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setIsFinished: (_isFinished: boolean) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startCountdown: (_duration?: number) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setStartTime: (_startTime: number) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handlePresetTime: (_minutes: number) => {},
  handleCancel: () => {},
  replay: false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setReplay: (_replay: boolean) => {},
  tasks: {
    tasks: [] as Task[],
    totalCount: 0,
    hasNextPage: false,
    nextPage: null,
  },
  setTasks: () => {},
})

// Add global type declaration for browser

type TimerState = {
  time: number
  isCountingDown: boolean
  isPaused: boolean
  isFinished: boolean
  source?: string
  timestamp?: number
  startTime: number
  isFinalState?: boolean
  isCanceled?: boolean
}

export type Task = {
  id: string
  title: string
  createdOn: Date
  modifiedOn: Date
  description?: string
  total?: { date: string; count: number }[]
  order: number
  selected?: boolean
}

export function TimerContextProvider({
  children,
}: {
  children: ReactNode
}): ReactElement {
  const {
    token,
    enableNotifications,
    user,
    deviceId,
    fingerprint,
    fetchMood,
    plausible,
    tasks,
    setTasks,
    isLoadingTasks,
    fetchTasks,
    session,
    ...auth
  } = useAuth()

  const { enableSound } = useTheme()

  const { send } = useWebSocket<{
    // timer: timer & { deviceId?: string }
    type: string
    // mood: mood
    // selectedTasks: Task[]
    deviceId: string
    data: timer
  }>({
    onMessage: async ({ type, data }) => {
      if (type === "timer") {
        await fetchTimer()
        setRemoteTimer(data)
      }

      if (type === "tasks") {
        await fetchTimer()
      }

      if (type === "mood") {
        await fetchMood()
      }
    },
    token,
    deviceId,
    deps: [fingerprint],
  })

  const isExtension = usePlatform()
  const [time, setTime] = useState(0)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [replay, setReplay] = useState<boolean>(false)
  const [timer, setTimerInternal] = useState<timer | null>(null)

  // API-first: Use state instead of localStorage
  // Timer state comes from DB via SWR, localStorage only for offline cache
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [activePomodoro, setActivePomodoro] = useState<number | null>(null)

  const setTimer = useCallback(
    (timer: timer | null) => {
      if (timer) auth.setTimer(timer)
      setTimerInternal((prevTimer) => {
        if (
          prevTimer?.id === timer?.id &&
          prevTimer?.isCountingDown === timer?.isCountingDown &&
          prevTimer?.count === timer?.count &&
          prevTimer?.preset1 === timer?.preset1 &&
          prevTimer?.preset2 === timer?.preset2 &&
          prevTimer?.preset3 === timer?.preset3
        ) {
          return prevTimer // No change, prevent re-render
        }

        return timer
      })
    },
    [auth],
  ) // Only depend on auth.setTimer, which is stable

  const [remoteTimer, setRemoteTimer] = useState<
    (timer & { device?: device }) | null
  >(null)

  const [isPaused, setIsPaused] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)

  const lastFilteredTasksRef = useRef<string>("")

  const [presetMin1, setPresetMin1Internal] = useLocalStorage(
    "presetMin1",
    timer?.preset1 || 25,
  )

  const lastSent = useRef(0)

  const [selectedTasks, setSelectedTasksInternal] = useLocalStorage<
    Task[] | undefined
  >(STORAGE_SELECTED_TASKS_KEY, undefined)

  useEffect(() => {
    // Safety check: ensure tasks.tasks exists
    if (!tasks?.tasks || !Array.isArray(tasks.tasks)) return

    // Create a stable key from task IDs to detect actual changes
    const taskIdsKey = tasks.tasks.map((t) => t.id).join(",")

    // Skip if tasks haven't actually changed
    if (lastFilteredTasksRef.current === taskIdsKey) return

    lastFilteredTasksRef.current = taskIdsKey

    setSelectedTasksInternal((currentSelected) => {
      if (!currentSelected?.length || !tasks?.tasks?.length)
        return currentSelected

      const filtered = currentSelected.filter((task) =>
        tasks.tasks.some((t) => t.id === task.id),
      )

      // Only update if there are actual changes
      if (
        filtered?.length !== currentSelected?.length ||
        filtered?.some(
          (t, i) => currentSelected[i] && t.id !== currentSelected[i].id,
        )
      ) {
        return filtered
      }

      return currentSelected
    })
  }, [setSelectedTasksInternal, tasks?.tasks])

  const updateTimer = useCallback(
    (data: timer) => {
      if (!token) return

      // Filter out tasks with empty total arrays (not actively running)
      const activeTasks = selectedTasks?.filter(
        (task) => task.total && task.total.length > 0,
      )

      if (!data.isCountingDown) {
        send({
          timer: data,
          selectedTasks: activeTasks,
          type: "timer",
          isCountingDown: false,
        })
        return
      }

      const now = Date.now()
      if (now - lastSent.current >= 5000) {
        send({
          timer: data,
          selectedTasks: activeTasks,
          type: "timer",
        })
        lastSent.current = now
      }
    },
    [token, selectedTasks, send],
  )

  const setPresetMin1 = useCallback(
    (value: number) => {
      setPresetMin1Internal(value)
      if (timer) {
        const newTimer = { ...timer, preset1: value }
        setTimer(newTimer)
        updateTimer(newTimer)
      }
    },
    [setPresetMin1Internal, setTimer, timer, updateTimer],
  )

  const [presetMin2, setPresetMin2Internal] = useLocalStorage(
    "presetMin2",
    timer?.preset2 || 15,
  )

  const setPresetMin2 = useCallback(
    (value: number) => {
      setPresetMin2Internal(value)
      if (fingerprint && timer) {
        const newTimer = { ...timer, preset2: value }
        setTimer(newTimer)
        updateTimer(newTimer)
      }
    },
    [fingerprint, setPresetMin2Internal, setTimer, timer, updateTimer],
  )

  const [presetMin3, setPresetMin3Internal] = useLocalStorage(
    "presetMin3",
    timer?.preset3 || 5,
  )

  const setPresetMin3 = useCallback(
    (value: number) => {
      setPresetMin3Internal(value)
      if (fingerprint && timer) {
        const newTimer = { ...timer, preset3: value }
        setTimer(newTimer)
        updateTimer(newTimer)
      }
    },
    [fingerprint, setPresetMin3Internal, setTimer, timer, updateTimer],
  )

  const setSelectedTasks = useCallback(
    (value: Task[] | undefined) => {
      setSelectedTasksInternal(value)
    },
    [setSelectedTasksInternal],
  )

  const [startTime, setStartTime] = useLocalStorage<number>(
    "startTime",
    timer?.count || 0,
  )
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const isTimerEndingRef = useRef<boolean>(false)
  const adjustIntervalRef = useRef<number | null>(null)
  const hasRestoredTimerRef = useRef<boolean>(false)

  const [playBirds, setPlayBirds] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!timer?.id) return
    setPresetMin1Internal(timer.preset1)
    setPresetMin2Internal(timer.preset2)
    setPresetMin3Internal(timer.preset3)
  }, [
    setPresetMin1Internal,
    setPresetMin2Internal,
    setPresetMin3Internal,
    timer?.id,
    timer?.preset1,
    timer?.preset2,
    timer?.preset3,
  ])

  const [shouldFetchTimer, setShouldFetchTimer] = useState(true)

  const {
    data: timerData,
    mutate: refetchTimer,
    isLoading: isLoadingTimer,
  } = useSWR(
    deviceId && token && session && shouldFetchTimer ? ["timer"] : null, // Disabled by default, fetch manually with refetchTimer()
    async () => {
      const response = await apiFetch(`${API_URL}/timers/${deviceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.json()
    },
  )

  const hasAutoResumedRef = useRef(false)

  const fetchTimer = useCallback(async () => {
    setShouldFetchTimer(true)
    return refetchTimer()
  }, [refetchTimer])

  useEffect(() => {
    if (timerData) {
      // Mark as restored to prevent multiple initializations
      hasRestoredTimerRef.current = true

      // Update timer object
      setTimer(timerData)

      // Restore timer state from API
      if (timerData.isCountingDown && timerData.count > 0) {
        setTime(timerData.count)
        setIsCountingDown(true)

        setIsPaused(false)
        setIsFinished(false)
        setStartTime(Date.now())

        // Timer will start via the isCountingDown state change
      } else if (timerData.count > 0) {
        // Timer is paused
        setTime(timerData.count)
        setIsCountingDown(false)
        setIsPaused(true)
        setIsFinished(false)
      } else {
        // Timer is at 0
        setTime(0)
        setIsCountingDown(false)
        setIsPaused(false)
        setIsFinished(true)
      }
    }
  }, [setStartTime, setTimer, timerData])

  useEffect(() => {
    if (!timer && token && fingerprint && user && !isLoadingTimer) {
      fetchTimer()
    }
  }, [fingerprint, token, user, timer, isLoadingTimer, fetchTimer])

  useEffect(() => {
    if (!token || !isCountingDown || isPaused || !selectedTasks?.length) return

    const currentElapsed = startTime
      ? Math.floor((Date.now() - startTime) / 1000)
      : 0
    if (currentElapsed === 0) return

    const currentDay = new Date()
    const selectedIds = new Set(selectedTasks.map((t) => t.id))

    // TEK SEFERDE TÜMÜNÜ GÜNCELLEME (BAM!)
    setTasks((prevTasks) => {
      if (!prevTasks) return prevTasks

      const newTasksList = prevTasks.tasks.map((task) => {
        // Sadece seçili olanları mürle
        if (!selectedIds.has(task.id)) return task

        const hasDay = task.total?.find((t) =>
          isSameDay(new Date(t.date), currentDay),
        )

        const updatedTotal = hasDay
          ? task.total?.map((t) =>
              isSameDay(new Date(t.date), currentDay)
                ? { ...t, count: t.count + 1 }
                : t,
            )
          : [
              ...(task.total || []),
              { date: currentDay.toISOString(), count: 1 },
            ]

        return { ...task, total: updatedTotal }
      })

      // Side Effect'i burada değil, başka bir useEffect'te yakalamak en Sato'su!
      return { ...prevTasks, tasks: newTasksList }
    })
  }, [
    time,
    isCountingDown,
    isPaused,
    token,
    selectedTasks,
    startTime,
    setTasks,
  ])

  // Use ref to plausible timer sync - only sync on state changes, not every second
  const timerSyncRef = useRef<number>(0)

  useEffect(() => {
    if (!timer || !fingerprint) return

    // Sync timer state every 5 seconds while counting, or immediately on state change
    const now = Date.now()
    const shouldSync =
      !isCountingDown || // State changed (stopped/paused)
      now - timerSyncRef.current >= 5000 // 5s throttle while running

    if (!shouldSync) return

    timerSyncRef.current = now

    const updatedTimer = {
      ...timer,
      preset1: presetMin1,
      preset2: presetMin2,
      preset3: presetMin3,
      isCountingDown,
      count: time,
    }

    // Update local state
    setTimer(updatedTimer)

    // Sync to WebSocket and DB
    updateTimer(updatedTimer)

    // Persist to localStorage via hook
    setTimerState({
      time,
      isCountingDown,
      isPaused,
      startTime,
      timestamp: now,
      isFinished: false,
    })
  }, [
    time,
    isCountingDown,
    isPaused,
    timer,
    fingerprint,
    presetMin1,
    presetMin2,
    presetMin3,
    startTime,
    setTimer,
    updateTimer,
  ])

  const currentStateRef = useRef({
    time: 0,
    isCountingDown: false,
    isPaused: false,
    isFinished: false,
  })

  useEffect(() => {
    currentStateRef.current = {
      time,
      isCountingDown,
      isPaused,
      isFinished,
    }
  }, [time, isCountingDown, isPaused, isFinished])

  const handleCancel = useCallback(() => {
    setIsCancelled(true)
    setPlayBirds(false)
    // Prevent multiple cancellations
    // if (isTimerEndingRef.current) {
    //   return
    // }
    isTimerEndingRef.current = true

    // Clear any existing timer interval
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }

    if (timer) {
      updateTimer({
        ...timer,
        count: 0,
        isCountingDown: false,
      })

      setTimer({
        ...timer,
        count: 0,
        isCountingDown: false,
      })
    }

    setTime(0)
    setIsCountingDown(false)
    setIsPaused(false)
    setIsFinished(true)

    // Clear timer state
    setTimerState(null)

    plausible({ name: "timer_cancel" })

    // Reset the flag after a short delay
    setTimeout(() => {
      isTimerEndingRef.current = false
    }, 500)
  }, [timer, plausible, updateTimer, setTimer])

  const handlePause = useCallback(
    (update: boolean = true) => {
      setIsPaused(true)
      setIsCountingDown(false)
      setIsCancelled(false)

      // Clear interval if running locally
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = undefined
      }

      // Update local storage for web version
      setTimerState({
        time,
        isCountingDown: false,
        isPaused: true,
        timestamp: Date.now(),
        startTime,
        isFinished: false,
      })

      if (timer && update) {
        updateTimer({ ...timer, isCountingDown: false })
      }

      plausible({ name: "timer_pause", props: { timeLeft: time } })
    },
    [timer, updateTimer, time, startTime, plausible],
  )

  const handlePresetTime = useCallback(
    (minutes: number) => {
      const newTime = minutes * 60
      setIsPaused(true)
      setIsFinished(false)
      setTime(newTime)
      setActivePomodoro(minutes)

      // Stop any running timer
      if (isCountingDown) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = undefined
        }
        setIsCountingDown(false)
      }

      // Save timer state
      setTimerState({
        time: newTime,
        isCountingDown: false,
        isPaused: true,
        timestamp: Date.now(),
        startTime: Date.now(),
        isFinished: false,
      })

      // Save active Pomodoro separately
      setActivePomodoro(minutes)

      // Track event
      plausible({ name: "timer_preset", props: { minutes, timeSet: newTime } })
    },
    [isCountingDown, plausible],
  )

  // Active pomodoro is now loaded automatically via useLocalStorage hook

  // Set mounted state

  // Restore timer state on mount

  const audioRef = useRef<HTMLAudioElement | undefined>(undefined)

  const kitasakuRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (playBirds) plausible({ name: "play_bird_sound" })

    // Only use Audio API on web (check for global Audio constructor)
    if (typeof window !== "undefined" && "Audio" in window) {
      audioRef.current = audioRef.current || new window.Audio()
    }

    if (playBirds) {
      ;(async () => {
        if (!audioRef.current) return

        try {
          audioRef.current.src = `${FRONTEND_URL}/sounds/birds.mp3`
          audioRef.current.loop = true
          audioRef.current.volume = 0.5

          // Preload and play
          audioRef.current.load()
          await audioRef.current.play().catch((error) => {
            console.log("Audio playback failed:", error)
          })
        } catch (error) {
          console.error("Error playing notification sound:", error)
        }
      })()
    } else {
      audioRef.current?.pause()
    }
  }, [playBirds, isExtension, plausible])

  const playTimerEnd = useCallback(async () => {
    // Only play sound in web mode (check for global Audio API)
    if (!enableSound || typeof window === "undefined" || !("Audio" in window)) {
      return
    }

    try {
      const audio = new window.Audio()
      audio.src = `${FRONTEND_URL}/sounds/timer-end.mp3`
      audio.volume = 0.9

      // Preload and play
      audio.load()
      await audio.play().catch((error: Error) => {
        console.log("Audio playback failed:", error)
      })
    } catch (error) {
      console.error("Error playing notification sound:", error)
    }
  }, [enableSound])

  const isNotificationSupported = typeof Notification !== "undefined"

  const sendNotification = useCallback(() => {
    if (!enableNotifications || isExtension) return
    if (!isNotificationSupported) return

    try {
      if (Notification.permission === "granted") {
        new Notification("Time's up!", {
          body: "Your focus session has ended.",
          icon: "/icons/icon-128.png",
        })
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === "granted") {
              new Notification("Time's up!", {
                body: "Your focus session has ended.",
                icon: "/icons/icon-128.png",
              })
            }
          })
          .catch((error) => {
            console.log("Notification permission request failed:", error)
          })
      }
    } catch (error) {
      console.log("Notification failed:", error)
    }
  }, [enableNotifications, isExtension, isNotificationSupported])

  const startAdjustment = useCallback(
    (direction: number, isMinutes: boolean = false) => {
      // Stop any running timer
      if (isCountingDown) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = undefined
        }
        setIsCountingDown(false)
        setIsPaused(false)
        setIsFinished(false)
      }

      // Set to paused state when adjusting time
      setIsPaused(true)

      const increment = isMinutes ? 60 : 1 // 60 seconds for minutes, 1 for seconds
      const adjustTime = () => {
        setTime((prevTime: number) => {
          const newTime = prevTime + direction * increment
          // Ensure time stays within bounds (0 to 60 minutes)
          const boundedTime = Math.max(0, Math.min(3600, newTime))
          return boundedTime
        })
      }

      adjustTime() // Initial adjustment

      if (!adjustIntervalRef.current) {
        // 300ms for minutes, 250ms for seconds
        const intervalTime = isMinutes ? 300 : 250

        adjustIntervalRef.current = window.setInterval(adjustTime, intervalTime)
      }
    },
    [isCountingDown],
  )
  const handleTimerEnd = useCallback(() => {
    if (!isCountingDown) return

    setIsFinished(true)
    setPlayBirds(false)

    if (timer) {
      updateTimer({
        ...timer,
        count: 0,
        isCountingDown: false,
      })
    }

    setIsCountingDown(false)
    setIsPaused(false)
    setTime(0)

    // Clear timer state immediately
    setTimerState(null)

    // Clear interval
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }

    // Play sound and show notification
    playTimerEnd()
    sendNotification()
  }, [isCountingDown, timer, playTimerEnd, sendNotification, updateTimer])

  const startCountdown = useCallback(
    (duration?: number) => {
      if (duration !== undefined) {
        setTime(duration)
      }

      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = undefined
      }

      setIsCountingDown(true)
      setIsPaused(false)
      setIsFinished(false)
      setIsCancelled(false)

      const now = Date.now()
      setStartTime(now)

      if (timer) {
        updateTimer({
          ...timer,
          isCountingDown: true,
        })
      }

      console.log("Starting web timer")
      // Start local timer for web mode
      const initialTime = duration ?? time
      let lastUpdate = now

      timerRef.current = setInterval(() => {
        const currentTime = Date.now()
        const elapsedTime = Math.floor((currentTime - lastUpdate) / 1000)

        if (elapsedTime > 0) {
          lastUpdate = currentTime - ((currentTime - lastUpdate) % 1000)

          setTime((prevTime) => {
            const newTime = Math.max(0, prevTime - elapsedTime)

            if (newTime === 0 && prevTime > 0) {
              clearInterval(timerRef.current)
              timerRef.current = undefined
              // Trigger timer end after state update
              setTimeout(() => handleTimerEnd(), 0)
            }
            return newTime
          })
        }
      }, 100)

      // Save state to localStorage
      setTimerState({
        time: initialTime,
        isCountingDown: true,
        isPaused: false,
        startTime: now,
        isFinished: false,
      })

      plausible({ name: "timer_start", props: { duration: duration || time } })
    },
    [setStartTime, timer, time, plausible, updateTimer, handleTimerEnd],
  )

  const restoreTimerState = useCallback(async () => {
    try {
      // State is now loaded automatically via useLocalStorage hook
      if (!timerState) {
        return
      }
      const state = timerState

      // If timer was running, calculate elapsed time
      if (state.isCountingDown && !state.isPaused && state.startTime) {
        const elapsedTime = Math.floor((Date.now() - state.startTime) / 1000)
        state.time = Math.max(0, state.time - elapsedTime)
      }

      console.log("Restoring timer state:", state)

      if (state) {
        setTime(state.time)
        setIsCountingDown(state.isCountingDown)
        setIsPaused(state.isPaused)
        setIsFinished(state.isFinished)

        if (state.startTime) {
          setStartTime(state.startTime)
        }

        // If timer was running, restart it
        if (state.isCountingDown && !state.isPaused && state.time > 0) {
          startCountdown(state.time)
        }
      }
    } catch (error) {
      console.error("Error restoring timer state:", error)
    }
  }, [setStartTime, startCountdown, timerState])

  useEffect(() => {
    restoreTimerState()
  }, [restoreTimerState])

  const handleResume = useCallback(() => {
    setIsPaused(false)
    setIsCancelled(false)
    setIsCountingDown(true)

    const now = Date.now()
    setStartTime(now)

    // Start the timer with current remaining time
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Start countdown with current display time
    startCountdown(time)

    plausible({ name: "timer_resume", props: { timeLeft: time } })
  }, [setStartTime, startCountdown, time, plausible])

  useEffect(() => {
    if (!timer) return

    if (timer.isCountingDown === isCountingDown) return

    if (isCountingDown) {
      handleResume()
    } else {
      handlePause()
    }

    // updateTimer(timer)
  }, [timer, isCountingDown, handleResume, handlePause])

  useEffect(() => {
    if (isCountingDown) return // Already counting
    if (!timerData?.isCountingDown) return // DB says not counting
    if (timerData.count === 0) return // Timer finished
    if (hasAutoResumedRef.current) return // Already auto-resumed

    hasAutoResumedRef.current = true
    handleResume()
  }, [timerData?.isCountingDown, timerData.count, isCountingDown, handleResume])

  useEffect(() => {
    if (!remoteTimer || remoteTimer.count !== timer?.count) return
    if (!remoteTimer?.isCountingDown) {
      handlePause(false)
    } else {
      handleResume()
    }

    setRemoteTimer(null)
  }, [handlePause, handleResume, remoteTimer, timer])

  useEffect(() => {
    if (!isFinished && replay) {
      setTimeout(() => {
        if (replay) {
          handlePresetTime(presetMin1)
          startCountdown()
        }
      }, 1000)
    }
  }, [handlePresetTime, isFinished, presetMin1, replay, startCountdown])

  useEffect(() => {
    if (time === 0 && isCountingDown) {
      handleTimerEnd()
    }
  }, [time, isCountingDown, handleTimerEnd])

  const stopAdjustment = useCallback(() => {
    if (adjustIntervalRef.current) {
      clearInterval(adjustIntervalRef.current)
      adjustIntervalRef.current = null
    }
  }, [])

  // Handle keyboard events

  useEffect(() => {
    if (isFinished) {
      setPlayBirds(false)
      const timer = setTimeout(() => {
        setIsFinished(false)
      }, 1000) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [isFinished])

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (adjustIntervalRef.current) clearInterval(adjustIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (isExtension) {
      console.log("Setting up message listener")

      return () => {
        // Clean up any timers if needed
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = undefined
        }
      }
    }
  }, [isExtension])

  const [playKitasaku, setPlayKitasaku] = useState(false)

  useEffect(() => {
    if (playKitasaku) {
      plausible({
        name: "video_clicked",
        props: {
          description: "Mark Barrott's Kitasaku clicked",
        },
      })
      kitasakuRef.current?.play()
    } else {
      kitasakuRef.current?.pause()
    }
  }, [plausible, playKitasaku])

  useEffect(() => {
    if (!tasks?.totalCount || selectedTasks) return
    if (!tasks?.tasks || !Array.isArray(tasks.tasks)) return

    const filter = tasks.tasks.filter((task) => task.selected)
    setSelectedTasksInternal(filter)
  }, [selectedTasks, setSelectedTasksInternal, tasks?.tasks, tasks?.totalCount])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      remoteTimer,
      selectedTasks,
      setSelectedTasks,
      presetMin1,
      presetMin2,
      presetMin3,
      setPresetMin1,
      setPresetMin2,
      setPresetMin3,
      playKitasaku,
      setPlayKitasaku,
      stopAdjustment,
      startAdjustment,
      playTimerEnd,
      playBirds,
      setPlayBirds,
      activePomodoro,
      setActivePomodoro,
      time,
      isCountingDown,
      isPaused,
      isFinished,
      startTime,
      setIsCountingDown,
      setIsPaused,
      setTime,
      setIsFinished,
      startCountdown,
      setStartTime,
      handlePresetTime,
      handleCancel,
      replay,
      setReplay,
      tasks,
      setTasks,
      timer,
      setTimer,
      updateTimer,
      handlePause,
      handleResume,
      isCancelled,
      fetchTasks,
      isLoadingTasks,
      fetchTimer,
    }),
    [
      remoteTimer,
      selectedTasks,
      setSelectedTasks,
      presetMin1,
      presetMin2,
      presetMin3,
      setPresetMin1,
      setPresetMin2,
      setPresetMin3,
      playKitasaku,
      stopAdjustment,
      startAdjustment,
      playTimerEnd,
      playBirds,
      activePomodoro,
      time,
      isCountingDown,
      isPaused,
      isFinished,
      startTime,
      startCountdown,
      setStartTime,
      handlePresetTime,
      handleCancel,
      replay,
      tasks,
      setTasks,
      timer,
      setTimer,
      updateTimer,
      handlePause,
      handleResume,
      isCancelled,
      fetchTasks,
      isLoadingTasks,
      fetchTimer,
    ],
  )

  return (
    <TimerContext.Provider value={contextValue}>
      <Audio
        onEnded={() => {
          setPlayKitasaku(false)
        }}
        ref={kitasakuRef}
        src={`https://7079yofdv0.ufs.sh/f/5ALK9G4mxClOzaZ7Raq4EKF7sQYcoB0gvqwN1HhxA3pMTtmI`}
      />
      {children}
    </TimerContext.Provider>
  )
}

export const useTimerContext = () => {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error(
      "useTimerContext must be used within a TimerContextProvider",
    )
  }

  return context
}
