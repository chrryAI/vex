"use client"

import {
  useEffect,
  useMemo,
  createContext,
  useContext,
  useRef,
  useState,
  SetStateAction,
  useCallback,
} from "react"
import type { ReactElement, ReactNode } from "react"
import { Signal, useSignal, useComputed, effect } from "@preact/signals-react"

import { isSameDay, FRONTEND_URL, apiFetch, API_URL } from "../utils"
import { device, timer } from "../types"
import console from "../utils/log"

import useSWR from "swr"
import { useWebSocket } from "../hooks/useWebSocket"
import { useAuth } from "./providers"
import { usePlatform, useTheme, Audio } from "../platform"
import { createTimerModel, TimerModel, Task } from "../models/TimerModel"

export type { Task } // Re-export Task

export const STORAGE_SELECTED_TASKS_KEY = "selectedTasks"

// Define the Context Value Interface with Signals
export interface TimerContextValue {
  // Signals
  time: Signal<number>
  isCountingDown: Signal<boolean>
  isPaused: Signal<boolean>
  isFinished: Signal<boolean>
  isCancelled: Signal<boolean>
  startTime: Signal<number>
  presetMin1: Signal<number>
  presetMin2: Signal<number>
  presetMin3: Signal<number>
  activePomodoro: Signal<number | null>
  playBirds: Signal<boolean>
  playKitasaku: Signal<boolean>
  replay: Signal<boolean>
  selectedTasks: Signal<Task[] | undefined>

  // Computed / Other Signals
  remoteTimer: Signal<(timer & { device?: device }) | null>

  // Actions
  startCountdown: (duration?: number) => void
  pause: () => void
  resume: () => void
  handleCancel: () => void
  handlePresetTime: (minutes: number) => void
  startAdjustment: (direction: number, isMinutes: boolean) => void
  stopAdjustment: () => void
  setPresetMin1: (value: number) => void
  setPresetMin2: (value: number) => void
  setPresetMin3: (value: number) => void
  setPlayBirds: (value: boolean) => void
  setPlayKitasaku: (value: boolean) => void
  setReplay: (value: boolean) => void
  setSelectedTasks: (value: Task[] | undefined) => void
  setActivePomodoro: (value: number | null) => void
  setIsFinished: (value: boolean) => void
  setIsPaused: (value: boolean) => void
  setIsCountingDown: (value: boolean) => void
  setTime: (value: number) => void
  setStartTime: (value: number) => void

  // Legacy / Sync methods
  fetchTimer: () => Promise<void>
  updateTimer: (data: timer) => void
  timer: timer | null
  setTimer: (timer: timer | null) => void

  playTimerEnd: () => void

  // Tasks (Global) - Not fully migrated to model yet as it relies on SWR/Auth
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
  fetchTasks: () => Promise<void>
  isLoadingTasks: boolean
}

export const TimerContext = createContext<TimerContextValue | undefined>(undefined)

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

  // Initialize Model
  const model = useMemo(() => createTimerModel(), [])

  // Cleanup on unmount
  useEffect(() => {
    model.restoreState()
    return () => model.dispose()
  }, [model])

  // Remote Timer Signal
  const remoteTimer = useSignal<(timer & { device?: device }) | null>(null)

  // Timer sync object (keep local state for now to match interface)
  const [timerDataSync, setTimerDataSync] = useState<timer | null>(null)

  const { send } = useWebSocket<{
    type: string
    deviceId: string
    data: timer
  }>({
    onMessage: async ({ type, data }) => {
      if (type === "timer") {
        await fetchTimer()
        remoteTimer.value = data
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

  // Sync Logic
  effect(() => {
    const rTimer = remoteTimer.value
    if (!rTimer || rTimer.count !== timerDataSync?.count) return
    if (!rTimer?.isCountingDown) {
      model.pause()
    } else {
      model.resume()
    }
    remoteTimer.value = null
  })

  // Sync global tasks to selectedTasks (if active)
  useEffect(() => {
     if (!tasks?.tasks || !Array.isArray(tasks.tasks)) return

     const filter = tasks.tasks.filter((task) => task.selected)
     if (filter.length > 0) {
        if (!model.selectedTasks.value) {
            model.selectedTasks.value = filter
        }
     }

     // Sync deletions/updates
     const currentSelected = model.selectedTasks.value
     if (currentSelected?.length) {
         const filtered = currentSelected.filter((task) =>
            tasks.tasks.some((t) => t.id === task.id),
         )

         if (filtered.length !== currentSelected.length) {
             model.selectedTasks.value = filtered
         }
     }
  }, [tasks?.tasks, tasks?.totalCount])

  // Update Timer (WebSocket)
  const lastSent = useRef(0)

  const updateTimer = useCallback((data: timer) => {
      if (!token) return

      const activeTasks = model.selectedTasks.value?.filter(
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
  }, [token, send, model.selectedTasks])

  // Subscribe model changes to trigger updateTimer
  useEffect(() => {
    return effect(() => {
        const t = model.time.value
        const counting = model.isCountingDown.value
        const p1 = model.presetMin1.value
        const p2 = model.presetMin2.value
        const p3 = model.presetMin3.value

        if (!timerDataSync) return

        const newTimer = {
            ...timerDataSync,
            count: t,
            isCountingDown: counting,
            preset1: p1,
            preset2: p2,
            preset3: p3
        }

        updateTimer(newTimer)
    })
  }, [timerDataSync, token, updateTimer])

  // Timer Fetching Logic (SWR)
  const [shouldFetchTimer, setShouldFetchTimer] = useState(true)
  const {
    data: timerData,
    mutate: refetchTimer,
    isLoading: isLoadingTimer,
  } = useSWR(
    deviceId && token && session && shouldFetchTimer ? ["timer"] : null,
    async () => {
      const response = await apiFetch(`${API_URL}/timers/${deviceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.json()
    },
  )

  const fetchTimer = async () => {
    setShouldFetchTimer(true)
    shouldFetchTimer && refetchTimer()
  }

  // Handle SWR Data
  useEffect(() => {
    if (timerData) {
        setTimerDataSync(timerData)
        auth.setTimer(timerData)

       if (timerData.count !== undefined) {
           model.time.value = timerData.count
       }
       if (timerData.preset1) model.presetMin1.value = timerData.preset1
       if (timerData.preset2) model.presetMin2.value = timerData.preset2
       if (timerData.preset3) model.presetMin3.value = timerData.preset3

       if (timerData.isCountingDown) {
           if (timerData.count > 0 && !model.isCountingDown.value) {
               model.startCountdown(timerData.count)
           }
       } else {
           if (model.isCountingDown.value) {
               model.pause()
           }
       }
    }
  }, [timerData])

  useEffect(() => {
    if (!timerDataSync && token && fingerprint && user && !isLoadingTimer) {
      fetchTimer()
    }
  }, [fingerprint, token, user, timerDataSync, isLoadingTimer])


  // Task Time Tracking Logic
  useEffect(() => {
    return effect(() => {
        const counting = model.isCountingDown.value
        const paused = model.isPaused.value
        const start = model.startTime.value
        const selected = model.selectedTasks.value

        if (!token || !counting || paused || !selected?.length) return

        const currentElapsed = start
          ? Math.floor((Date.now() - start) / 1000)
          : 0
        if (currentElapsed === 0) return

        const currentDay = new Date()
        const selectedIds = new Set(selected.map((t) => t.id))

        // This causes frequent re-renders in React tree if setTasks updates state.
        // We might want to optimize this later, but for now we keep behavior.
        // However, updating React state from effect runs often.
        // SWR might handle deduping but setTasks is local state update.
        // The original code ran every second.

        // We can check if second changed?
        // But model.time updates every 100ms or 1s depending on interval.
        // Let's assume it's fine for now as per original.

        setTasks((prevTasks) => {
          if (!prevTasks) return prevTasks

          const newTasksList = prevTasks.tasks.map((task) => {
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
          return { ...prevTasks, tasks: newTasksList }
        })
    })
  }, [token, setTasks])

  // Play Timer End Logic
  const playTimerEnd = useCallback(() => {
     if (enableSound && typeof window !== "undefined" && "Audio" in window) {
          const audio = new (window as any).Audio()
          audio.src = `${FRONTEND_URL}/sounds/timer-end.mp3`
          audio.volume = 0.9
          audio.load()
          audio.play().catch(console.error)
     }

     if (enableNotifications && !isExtension && typeof Notification !== "undefined") {
         if (Notification.permission === "granted") {
            new Notification("Time's up!", { body: "Your focus session has ended.", icon: "/icons/icon-128.png" })
         }
     }
  }, [enableSound, enableNotifications, isExtension])

  // Timer End Sound Effect
  useEffect(() => {
      return effect(() => {
          if (model.isFinished.value) {
             playTimerEnd()
          }
      })
  }, [playTimerEnd])

  // Audio effect for Birds
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined)
  useEffect(() => {
      return effect(() => {
        const play = model.playBirds.value

        if (typeof window !== "undefined" && "Audio" in window) {
            audioRef.current = audioRef.current || new (window as any).Audio()
        }

        if (play) {
            if (audioRef.current) {
                audioRef.current.src = `${FRONTEND_URL}/sounds/birds.mp3`
                audioRef.current.loop = true
                audioRef.current.volume = 0.5
                audioRef.current.load()
                audioRef.current.play().catch(console.error)
            }
        } else {
            audioRef.current?.pause()
        }
      })
  }, [])

  const kitasakuRef = useRef<HTMLAudioElement | null>(null)

  // Value Construction
  const value = useMemo<TimerContextValue>(() => ({
      // Signals
      time: model.time,
      isCountingDown: model.isCountingDown,
      isPaused: model.isPaused,
      isFinished: model.isFinished,
      isCancelled: model.isCancelled,
      startTime: model.startTime,
      presetMin1: model.presetMin1,
      presetMin2: model.presetMin2,
      presetMin3: model.presetMin3,
      activePomodoro: model.activePomodoro,
      playBirds: model.playBirds,
      playKitasaku: model.playKitasaku,
      replay: model.replay,
      selectedTasks: model.selectedTasks,

      remoteTimer,

      // Actions
      startCountdown: model.startCountdown,
      pause: model.pause,
      resume: model.resume,
      handleCancel: model.cancel,
      handlePresetTime: model.handlePresetTime,
      startAdjustment: model.startAdjustment,
      stopAdjustment: model.stopAdjustment,

      setPresetMin1: (v) => model.presetMin1.value = v,
      setPresetMin2: (v) => model.presetMin2.value = v,
      setPresetMin3: (v) => model.presetMin3.value = v,
      setPlayBirds: (v) => model.playBirds.value = v,
      setPlayKitasaku: (v) => model.playKitasaku.value = v,
      setReplay: (v) => model.replay.value = v,
      setSelectedTasks: (v) => model.selectedTasks.value = v,
      setActivePomodoro: (v) => model.activePomodoro.value = v,

      setIsFinished: (v) => model.isFinished.value = v,
      setIsPaused: (v) => model.isPaused.value = v,
      setIsCountingDown: (v) => model.isCountingDown.value = v,
      setTime: (v) => model.time.value = v,
      setStartTime: (v) => model.startTime.value = v,

      playTimerEnd,

      // Legacy
      fetchTimer,
      updateTimer,
      timer: timerDataSync,
      setTimer: setTimerDataSync,

      tasks,
      setTasks,
      fetchTasks,
      isLoadingTasks
  }), [model, remoteTimer, timerDataSync, tasks, setTasks, fetchTasks, isLoadingTasks, playTimerEnd])

  return (
    <TimerContext.Provider value={value}>
      <Audio
        onEnded={() => {
          model.playKitasaku.value = false
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
