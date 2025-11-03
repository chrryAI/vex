"use client"

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  SetStateAction,
  createContext,
  useContext,
} from "react"

import { isSameDay, storage, FRONTEND_URL } from "../utils"
import { device, timer } from "../types"

import { API_URL, useLocalStorage } from ".."
import useSWR from "swr"
import { useWebSocket } from "../hooks/useWebSocket"
import { useAuth } from "./providers"
import { usePlatform, useTheme } from "chrry/platform"

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

  tasks: {
    tasks: Task[]
    totalCount: number
    hasNextPage: boolean
    nextPage: number | null
  }
  setTasks: (
    tasks:
      | {
          tasks: Task[]
          totalCount: number
          hasNextPage: boolean
          nextPage: number | null
        }
      | SetStateAction<{
          tasks: Task[]
          totalCount: number
          hasNextPage: boolean
          nextPage: number | null
        }>,
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
  setTimer: (timer: timer | null) => {},
  updateTimer: (data: timer) => {},
  selectedTasks: undefined,
  setSelectedTasks: (tasks: Task[] | undefined) => {},
  presetMin1: 25,
  presetMin2: 15,
  presetMin3: 5,
  setPresetMin1: (value: number) => {},
  setPresetMin2: (value: number) => {},
  setPresetMin3: (value: number) => {},
  handlePause: () => {},
  handleResume: () => {},
  playKitasaku: false,
  setPlayKitasaku: (playKitasaku: boolean) => {},
  stopAdjustment: () => {},
  startAdjustment: (direction: number, isMinutes: boolean) => {},
  playTimerEnd: () => {},
  fetchTasks: async () => {},
  fetchTimer: async () => {},
  isLoadingTasks: false,
  playBirds: false,
  setPlayBirds: (playBirds: boolean) => {},
  activePomodoro: null,
  setActivePomodoro: (activePomodoro: number | null) => {},
  time: 0,
  isCountingDown: false,
  isPaused: false,
  isFinished: false,
  startTime: 0,
  setIsCountingDown: (isCountingDown: boolean) => {},
  setIsPaused: (isPaused: boolean) => {},
  setTime: (time: number) => {},
  setIsFinished: (isFinished: boolean) => {},
  startCountdown: (duration?: number) => {},
  setStartTime: (startTime: number) => {},
  handlePresetTime: (minutes: number) => {},
  handleCancel: () => {},
  replay: false,
  setReplay: (replay: boolean) => {},
  tasks: {
    tasks: [] as Task[],
    totalCount: 0,
    hasNextPage: false,
    nextPage: null,
  },
  setTasks: (
    tasks:
      | {
          tasks: Task[]
          totalCount: number
          hasNextPage: boolean
          nextPage: number | null
        }
      | SetStateAction<{
          tasks: Task[]
          totalCount: number
          hasNextPage: boolean
          nextPage: number | null
        }>,
  ) => {},
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

export const STORAGE_KEY = "focusbutton_timer_state"

const POMODORO_KEY = "focusbutton_active_pomodoro"
const MAX_TIME = 3600 // 60 minutes in seconds

// Track events with GA4

export function TimerContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    token,
    enableNotifications,
    user,
    deviceId,
    fingerprint,
    track: trackEvent,
  } = useAuth()

  const { enableSound } = useTheme()

  const { send } = useWebSocket<{
    timer: timer
    type: string
    selectedTasks: Task[]
    fingerprint: string
  }>({
    onMessage: (data) => {
      if (data?.type === "timer" && data.timer.fingerprint !== fingerprint) {
        setRemoteTimer(data.timer)
      }

      if (data?.type === "selected_tasks") {
        setTimerTasks(data.selectedTasks)
        setSelectedTasksFingerprint(data.fingerprint)
      }
    },
    token,
    deviceId,
    deps: [fingerprint],
  })

  const isExtension = usePlatform()
  const [time, setTime] = useState(0)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [replay, setReplayInternal] = useState(false)
  const [timer, setTimer] = useState<timer | null>(null)

  const [remoteTimer, setRemoteTimer] = useState<
    (timer & { device?: device }) | null
  >(null)

  const setReplay = (replay: boolean) => {
    setReplayInternal(replay)
    storage?.set({
      replay,
    })
    localStorage.setItem("replay", JSON.stringify(replay))
  }

  useEffect(() => {
    ;(async () => {
      setReplayInternal(
        (await storage?.get("replay"))?.replay ||
          localStorage.getItem("replay") === "true" ||
          false,
      )
    })()
  }, [])

  const [isPaused, setIsPaused] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [activePomodoro, setActivePomodoro] = useState<number | null>(null)
  const [tasks, setTasks] = useLocalStorage<{
    tasks: Task[]
    totalCount: number
    hasNextPage: boolean
    nextPage: number | null
  }>("tasks", {
    tasks: [],
    totalCount: 0,
    hasNextPage: false,
    nextPage: null,
  })

  const [selectedTasksFingerprint, setSelectedTasksFingerprint] = useState<
    string | undefined
  >()

  const [timerTasks, setTimerTasks] = useState<Task[]>([])

  useEffect(() => {
    if (!selectedTasksFingerprint || selectedTasksFingerprint === fingerprint)
      return

    setTasks((prev) => {
      const hasUpdates = timerTasks.some((t) => {
        const task = prev.tasks.find((task) => task.id === t.id)
        return (
          task?.total &&
          t.total &&
          t.total.reduce((a, b) => a + b.count, 0) >
            task.total.reduce((a, b) => a + b.count, 0)
        )
      })

      return hasUpdates
        ? {
            ...prev,
            tasks: prev.tasks.map((task) => {
              const updatedTask = timerTasks.find((t) => t.id === task.id)
              if (!updatedTask?.total?.length || !task.total?.length)
                return task

              const updatedTotal = updatedTask.total.reduce(
                (a, b) => a + b.count,
                0,
              )
              const currentTotal = task.total.reduce((a, b) => a + b.count, 0)

              return updatedTotal > currentTotal
                ? { ...task, total: updatedTask.total }
                : task
            }),
          }
        : prev
    })
  }, [timerTasks, selectedTasksFingerprint, fingerprint])

  const [presetMin1, setPresetMin1Internal] = useLocalStorage(
    "presetMin1",
    timer?.preset1 || 25,
  )

  useEffect(() => {
    ;(async () => {
      storage?.set({
        presetSec1: presetMin1 * 60,
      })
    })()
  }, [presetMin1])

  const lastSent = useRef(0)

  const [selectedTasks, setSelectedTasksInternal] = useLocalStorage<
    Task[] | undefined
  >(STORAGE_SELECTED_TASKS_KEY, undefined)

  useEffect(() => {
    if (!selectedTasks || !tasks.tasks.length) return
    const filtered = selectedTasks.filter((task) =>
      tasks.tasks.some((t) => t.id === task.id),
    )

    if (
      filtered.length !== selectedTasks.length ||
      filtered.some((t, i) => selectedTasks[i] && t.id !== selectedTasks[i].id)
    ) {
      setSelectedTasks(filtered)
    }
  }, [tasks.tasks, selectedTasks])

  const updateTimer = useCallback(
    (data: timer) => {
      if (!token || !user) return

      if (!data.isCountingDown) {
        send({
          timer: data,
          selectedTasks,
          type: "timer",
          isCountingDown: false,
        })

        return
      }

      const now = Date.now()
      if (now - lastSent.current >= 5000) {
        send({
          timer: data,
          selectedTasks,
          type: "timer",
        })
        lastSent.current = now
      }
    },
    [send, selectedTasks, token, user, isCountingDown, isFinished, remoteTimer],
  )

  const setPresetMin1 = (value: number) => {
    setPresetMin1Internal(value)
    timer &&
      (() => {
        setTimer({
          ...timer,
          preset1: value,
        })
        updateTimer({
          ...timer,
          preset1: value,
        })
      })()
  }

  const [presetMin2, setPresetMin2Internal] = useLocalStorage(
    "presetMin2",
    timer?.preset2 || 15,
  )

  const setPresetMin2 = (value: number) => {
    setPresetMin2Internal(value)
    fingerprint &&
      timer &&
      (() => {
        setTimer({
          ...timer,
          preset2: value,
        })
        updateTimer({
          ...timer,
          preset2: value,
        })
      })()
  }

  const [presetMin3, setPresetMin3Internal] = useLocalStorage(
    "presetMin3",
    timer?.preset3 || 5,
  )

  const setPresetMin3 = (value: number) => {
    setPresetMin3Internal(value)
    fingerprint &&
      timer &&
      (() => {
        setTimer({
          ...timer,
          preset3: value,
        })
        updateTimer({
          ...timer,
          preset3: value,
        })
      })()
  }

  useEffect(() => {
    if (!tasks.totalCount || selectedTasks) return

    const filter = tasks.tasks.filter((task) => task.selected)
    setSelectedTasksInternal(filter)
  }, [tasks.totalCount])

  const setSelectedTasks: (value: Task[] | undefined) => void = (value) => {
    const newValue = value
    setSelectedTasksInternal(newValue)
    storage?.set({
      selectedTasks: newValue,
    })
  }

  const [startTime, setStartTime] = useLocalStorage<number>(
    "startTime",
    timer?.count || 0,
  )
  const timerRef = useRef<any | null>(null)
  const isTimerEndingRef = useRef<Boolean>(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastBackgroundStateRef = useRef<any>(null)
  const adjustIntervalRef = useRef<number | null>(null)
  const lastVisibilityUpdateRef = useRef<number>(0)

  const updateThrottleMs = 100

  const [playBirds, setPlayBirds] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!timer) return
    setPresetMin1Internal(timer.preset1)
    setPresetMin2Internal(timer.preset2)
    setPresetMin3Internal(timer.preset3)
  }, [timer])

  const [shouldFetchTimer, setShouldFetchTimer] = useState(false)

  const {
    data: timerData,
    mutate: refetchTimer,
    isLoading: isLoadingTimer,
  } = useSWR(
    token && shouldFetchTimer ? ["timer"] : null, // Disabled by default, fetch manually with refetchTimer()
    async () => {
      const response = await fetch(`${API_URL}/timers/${fingerprint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.json()
    },
  )

  const fetchTimer = async () => {
    setShouldFetchTimer(true)
    refetchTimer()
  }

  useEffect(() => {
    if (timerData) {
      setTimer(timerData)
    }
  }, [timerData])

  useEffect(() => {
    if (!timer && token && fingerprint && user && !isLoadingTimer) {
      fetchTimer()
    }
  }, [fingerprint, token, user, timer, isLoadingTimer])

  const [shouldFetchTasks, setShouldFetchTasks] = useState(false)

  const fetchTasks = async () => {
    setShouldFetchTasks(true)
  }

  const { data: tasksData, mutate: refetchTasks } = useSWR(
    token && shouldFetchTasks ? ["tasks"] : null, // Disabled by default, fetch manually with refetchTasks()
    async () => {
      const response = await fetch(`${API_URL}/tasks`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      return data
    },
  )

  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  // Only run this effect if tasks are reordered, added, or deleted

  useEffect(() => {
    if (tasksData) {
      Array.isArray(tasksData?.tasks) && setTasks(tasksData)
      setIsLoadingTasks(false)
    }
  }, [tasksData])

  useEffect(() => {
    if (token) {
      fetchTasks()
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    if (isCountingDown && selectedTasks?.length && !isPaused) {
      const currentDay = new Date()

      const currentElapsed = startTime
        ? Math.floor((Date.now() - startTime) / 1000)
        : 0

      if (currentElapsed === 0) {
        return
      }

      for (const selectedTask of selectedTasks) {
        setTasks((prevTasks) => ({
          ...prevTasks,
          tasks: prevTasks?.tasks?.map((task) => {
            if (task.id === selectedTask.id) {
              const hasDay = task.total?.find?.((t) =>
                isSameDay(new Date(t.date), currentDay),
              )

              const total = hasDay
                ? task.total?.map((t) => {
                    return {
                      ...t,
                      count: isSameDay(new Date(t.date), currentDay)
                        ? t.count + 1
                        : t.count,
                    }
                  })
                : task.total?.length
                  ? [
                      ...task.total,
                      { date: currentDay.toISOString(), count: 1 },
                    ]
                  : [{ date: currentDay.toISOString(), count: 1 }]

              setSelectedTasks(
                selectedTasks?.map((t) => {
                  if (t.id === task.id) {
                    return {
                      ...t,
                      total,
                    }
                  }
                  return t
                }),
              )

              return {
                ...task,
                total,
              }
            }
            return task
          }),
        }))
      }
    }
  }, [time, isCountingDown, isPaused, token])

  useEffect(() => {
    if (!isCountingDown || !timer || !fingerprint || !time) return

    !isExtension &&
      updateTimer({
        ...timer,
        preset1: presetMin1,
        preset2: presetMin2,
        preset3: presetMin3,
        isCountingDown,
        count: time,
      })
  }, [
    isCountingDown,
    timer,
    time,
    fingerprint,
    presetMin1,
    presetMin2,
    presetMin3,
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

  const handleTimerEnd = () => {
    if (!isCountingDown) return
    console.log("Timer ended")
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
    if (!isExtension) {
      localStorage.removeItem(STORAGE_KEY)
    }

    // Clear interval
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Play sound and show notification
    playTimerEnd()
    sendNotification()

    setTimeout(() => {
      if (replay) {
        handlePresetTime(presetMin1)
        startCountdown()
      }
    }, 1000)
  }

  useEffect(() => {
    if (time === 0 && isCountingDown) {
      handleTimerEnd()
    }
  }, [time, isCountingDown])

  const startCountdown = useCallback(
    (duration?: number) => {
      if (duration !== undefined) {
        setTime(duration)
      }

      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
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
            setTime(newTime)

            if (newTime === 0) {
              console.log("Timer reached zero")
              clearInterval(timerRef.current)
              timerRef.current = null
            }
            return newTime
          })
        }
      }, 100)

      // Save state to localStorage
      const state: TimerState = {
        time: initialTime,
        isCountingDown: true,
        isPaused: false,
        startTime: now,
        isFinished: false,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

      trackEvent({ name: "timer_start", props: { duration: duration || time } })
    },
    [time, isExtension, updateTimer, timer, fingerprint],
  )

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
      timerRef.current = null
    }

    if (timer) {
      updateTimer({
        ...timer,
        count: 0,
        isCountingDown: false,
      })
    }

    setTime(0)
    setIsCountingDown(false)
    setIsPaused(false)
    setIsFinished(true)

    if (!isExtension) {
      localStorage.removeItem(STORAGE_KEY)
    }

    trackEvent({ name: "timer_cancel" })

    // Reset the flag after a short delay
    setTimeout(() => {
      isTimerEndingRef.current = false
    }, 500)
  }, [isExtension, timer, fingerprint])

  const handlePause = () => {
    console.log("Pausing timer")

    setIsPaused(true)
    setIsCountingDown(false)
    setIsCancelled(false)

    timer && updateTimer({ ...timer, isCountingDown: false })

    // Clear interval if running locally
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Update local storage for web version
    const state = {
      type: "TIMER_UPDATE",
      isCountingDown: false,
      time,
      isPaused: true,
      source: "ui",
      timestamp: Date.now(),
      startTime,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    trackEvent({ name: "timer_pause", props: { timeLeft: time } })
  }

  const handleResume = () => {
    console.log("Resuming timer")

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

    trackEvent({ name: "timer_resume", props: { timeLeft: time } })
  }

  const handlePresetTime = (minutes: number) => {
    const newTime = minutes * 60
    setIsPaused(true)
    setIsFinished(false)
    setTime(newTime)
    setActivePomodoro(minutes)

    // Stop any running timer
    if (isCountingDown) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsCountingDown(false)
    }

    // Save to storage

    // Save timer state
    const state: TimerState = {
      time: newTime,
      isCountingDown: false,
      isPaused: true,
      startTime: Date.now(),
      isFinished: false,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    // Save active Pomodoro separately
    localStorage.setItem(POMODORO_KEY, minutes.toString())

    // Track event
    trackEvent({ name: "timer_preset", props: { minutes, timeSet: newTime } })
  }

  // Load active Pomodoro from storage
  useEffect(() => {
    const loadPomodoro = async () => {
      const savedPomodoro = localStorage.getItem(POMODORO_KEY)
      if (savedPomodoro) {
        setActivePomodoro(parseInt(savedPomodoro))
      }
    }
    loadPomodoro()
  }, [isExtension])

  // Set mounted state

  // Restore timer state on mount
  const restoreTimerState = useCallback(async () => {
    try {
      let state: TimerState | null = null

      const savedState = localStorage.getItem(STORAGE_KEY)
      if (savedState) {
        state = JSON.parse(savedState)
        if (!state) {
          return
        }

        // If timer was running, calculate elapsed time
        if (state.isCountingDown && !state.isPaused && state.startTime) {
          const elapsedTime = Math.floor((Date.now() - state.startTime) / 1000)
          state.time = Math.max(0, state.time - elapsedTime)
        }
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
  }, [isExtension])

  useEffect(() => {
    restoreTimerState()
  }, [restoreTimerState])

  const audioRef = useRef<HTMLAudioElement | undefined>(undefined)

  const kitasakuRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    playBirds === true
      ? trackEvent({ name: "play_bird_sound" })
      : playBirds === false && trackEvent({ name: "stop_bird_sound" })

    audioRef.current = audioRef.current || new Audio()

    if (playBirds) {
      ;(async () => {
        if (!audioRef.current) return

        try {
          audioRef.current.src = `${FRONTEND_URL}/birds.mp3`
          audioRef.current.loop = true
          audioRef.current.volume = 0.5

          // Initialize audio context if needed
          if (audioContextRef.current?.state === "suspended") {
            await audioContextRef.current.resume()
          }

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
  }, [playBirds, isExtension])

  const playTimerEnd = async () => {
    console.log(isExtension, "isExtension")

    // Only play sound in web mode, extension handles it via offscreen document
    if (isExtension || !enableSound) {
      return
    }

    try {
      const audio = new Audio()
      audio.src = `${FRONTEND_URL}/timer-end.mp3`
      audio.volume = 0.5

      // Initialize audio context if needed
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume()
      }

      // Preload and play

      audio.load()
      await audio.play().catch((error) => {
        console.log("Audio playback failed:", error)
      })
    } catch (error) {
      console.error("Error playing notification sound:", error)
    }
  }

  const isNotificationSupported = typeof Notification !== "undefined"

  const sendNotification = () => {
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
  }

  const startAdjustment = (direction: number, isMinutes: boolean = false) => {
    // Stop any running timer
    if (isCountingDown) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsCountingDown(false)
      setIsPaused(false)
      setIsFinished(false)

      // Clear extension timer state if in extension
    }

    // Set to paused state when adjusting time
    setIsPaused(true)

    const increment = isMinutes ? 60 : 1 // 60 seconds for minutes, 1 for seconds
    const adjustTime = () => {
      setTime((prevTime: number) => {
        const newTime = prevTime + direction * increment
        // Ensure time stays within bounds (0 to 60 minutes)
        const boundedTime = Math.max(0, Math.min(3600, newTime))
        setTime(boundedTime) // Update the actual time state

        // Update extension storage if in extension context

        return boundedTime
      })
    }

    adjustTime() // Initial adjustment

    if (!adjustIntervalRef.current) {
      // 500ms for minutes, 200ms for seconds
      const intervalTime = isMinutes ? 300 : 250

      adjustIntervalRef.current = window.setInterval(adjustTime, intervalTime)
    }
  }

  const stopAdjustment = () => {
    if (adjustIntervalRef.current) {
      clearInterval(adjustIntervalRef.current)
      adjustIntervalRef.current = null
    }
  }

  const handleVisibilityChange = useCallback(
    (now: number) => {
      if (document.hidden) {
        return
      }

      // App coming to foreground
      const savedTimer = localStorage.getItem("focusTimer")
      if (savedTimer) {
        try {
          const {
            timeLeft,
            startTime,
            isCountingDown: wasCountingDown,
            isPaused: wasPaused,
          } = JSON.parse(savedTimer)

          if (wasCountingDown && !wasPaused) {
            console.log("App coming to foreground, restoring timer state")
            const elapsedSeconds = Math.floor((now - startTime) / 1000)
            const newTime = Math.max(0, timeLeft - elapsedSeconds)

            if (newTime === 0) {
              console.log("Timer completed while in background")
            } else if (newTime > 0) {
              // Resume countdown if time remaining
              startCountdown(newTime)
            }
          }
        } catch (error) {
          console.error("Error parsing saved timer:", error)
        }
        localStorage.removeItem("focusTimer")
      }
    },
    [time, isCountingDown, startCountdown],
  )

  useEffect(() => {
    const handleVisibilityChangeWrapper = () => {
      const now = Date.now()
      // Prevent multiple updates within 1 second
      if (now - lastVisibilityUpdateRef.current < 1000) {
        return
      }
      lastVisibilityUpdateRef.current = now

      handleVisibilityChange(now)
    }

    document.addEventListener("visibilitychange", handleVisibilityChangeWrapper)
    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChangeWrapper,
      )
    }
  }, [handleVisibilityChange])

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
      const handleMessage = (message: any) => {
        console.log("Received message:", message)

        if (message.type === "TIMER_UPDATE") {
          console.log("Timer update message:", {
            remainingTime: message.remainingTime,
            running: message.running,
            isPaused: message.isPaused,
          })

          if (message.remainingTime !== undefined) {
            console.log("Updating time to:", message.remainingTime)
            setTime(message.remainingTime)

            // Start or update local timer for smooth UI updates
            if (message.running && !message.isPaused) {
              console.log("Starting local countdown timer")
              if (timerRef.current) {
                console.log("Clearing existing timer")
                clearInterval(timerRef.current)
              }
              timerRef.current = setInterval(() => {
                setTime((prevTime: number) => {
                  const newTime = Math.max(0, prevTime - 1)
                  console.log("Local timer update:", newTime)
                  if (newTime === 0) {
                    console.log("Timer reached zero, clearing interval")
                    clearInterval(timerRef.current)
                    timerRef.current = null
                  }
                  return newTime
                })
              }, 1000)
            } else if (timerRef.current) {
              console.log("Stopping local countdown timer")
              clearInterval(timerRef.current)
              timerRef.current = null
            }
          }

          if (message.running !== undefined) {
            console.log("Updating timer state:", {
              running: message.running,
              paused: !message.running,
            })
            setIsCountingDown(message.running)
            setIsPaused(!message.running)
          }
        }
      }

      console.log("Setting up message listener")

      return () => {
        // Clean up any timers if needed
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [isExtension])

  const [playKitasaku, setPlayKitasaku] = useState(false)

  useEffect(() => {
    if (playKitasaku) {
      trackEvent({ name: "video_clicked" })
      kitasakuRef.current?.play()
    } else {
      kitasakuRef.current?.pause()
    }
  }, [playKitasaku])

  return (
    <TimerContext.Provider
      value={{
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
        isLoadingTasks,
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
        fetchTimer,
      }}
    >
      <audio
        onEnded={() => {
          setPlayKitasaku(false)
        }}
        ref={kitasakuRef}
        src={`${FRONTEND_URL}/kitasaku.mp3`}
      />
      {children}
    </TimerContext.Provider>
  )
}

export const useTimerContext = () => {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error("useTimerContext must be used within a DriverProvider")
  }

  return context
}
