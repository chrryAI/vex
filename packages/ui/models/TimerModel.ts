import { signal, computed, effect, batch } from "@preact/signals-react"

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

export type TimerState = {
  time: number
  isCountingDown: boolean
  isPaused: boolean
  isFinished: boolean
  startTime: number
  timestamp?: number
}

export function createTimerModel() {
  // Signals
  const time = signal(0)
  const isCountingDown = signal(false)
  const isPaused = signal(false)
  const isFinished = signal(false)
  const isCancelled = signal(false)
  const startTime = signal(0)

  const presetMin1 = signal(25)
  const presetMin2 = signal(15)
  const presetMin3 = signal(5)

  const activePomodoro = signal<number | null>(null)

  // Audio/Visual flags
  const playBirds = signal(false)
  const playKitasaku = signal(false)
  const replay = signal(false)

  // Tasks
  const selectedTasks = signal<Task[] | undefined>(undefined)

  // Internal
  let timerInterval: any = null
  let adjustInterval: any = null

  // Persistence Helper
  const syncStorage = <T>(key: string, s: any, parser: (v: string) => T = JSON.parse) => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(key)
        if (stored !== null) {
          s.value = parser(stored)
        }
      } catch (e) {
        console.error(`Failed to load ${key}`, e)
      }

      // Listen for changes from other tabs
      const handleStorage = (e: StorageEvent) => {
        if (e.key === key && e.newValue) {
          try {
            s.value = parser(e.newValue)
          } catch (error) {
            console.error(`Failed to parse ${key} from storage event`, error)
          }
        } else if (e.key === key && !e.newValue) {
            // Item removed
            s.value = undefined
        }
      }
      window.addEventListener("storage", handleStorage)

      // Cleanup listener when model is disposed?
      // Since syncStorage is called in factory, we can't return cleanup easily to `effect` unless we wrap it.
      // But we can attach it to the dispose method of the model if we wanted.
      // However, `effect` below returns a cleanup for the write-effect.
      // We should probably combine them or manage listener lifecycle.
      // For a singleton context model, listener leak is acceptable until app reload,
      // but proper cleanup is better.
      // Let's rely on the fact that this model is likely a singleton in the app context.
      // But if we want to be strict, we need to expose cleanup.
    }

    return effect(() => {
      if (typeof window !== "undefined") {
        try {
            const val = s.value
            if (val === undefined) {
                window.localStorage.removeItem(key)
            } else {
                window.localStorage.setItem(key, JSON.stringify(val))
            }
        } catch (e) {
          console.error(`Failed to save ${key}`, e)
        }
      }
    })
  }

  const handleTimerEnd = () => {
    batch(() => {
      isFinished.value = true
      isCountingDown.value = false
      isPaused.value = false
      time.value = 0
      playBirds.value = false
    })

    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    // Auto-replay logic
    if (replay.value) {
      setTimeout(() => {
        handlePresetTime(presetMin1.value)
        startCountdown()
      }, 1000)
    }
  }

  const startCountdown = (duration?: number) => {
    batch(() => {
      if (duration !== undefined) {
        time.value = duration
      }
      isCountingDown.value = true
      isPaused.value = false
      isFinished.value = false
      isCancelled.value = false
      startTime.value = Date.now()
    })

    if (timerInterval) clearInterval(timerInterval)

    let lastUpdate = Date.now()

    timerInterval = setInterval(() => {
      const currentTime = Date.now()
      const elapsedTime = Math.floor((currentTime - lastUpdate) / 1000)

      if (elapsedTime > 0) {
        lastUpdate = currentTime - ((currentTime - lastUpdate) % 1000)

        if (time.peek() > 0) {
           time.value = Math.max(0, time.peek() - elapsedTime)
        }

        if (time.peek() === 0) {
           handleTimerEnd()
        }
      }
    }, 100)
  }

  const pause = () => {
    batch(() => {
      isPaused.value = true
      isCountingDown.value = false
    })
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  const resume = () => {
    batch(() => {
      isPaused.value = false
      isCountingDown.value = true
      isCancelled.value = false
      startTime.value = Date.now()
    })
    startCountdown(time.value)
  }

  const cancel = () => {
    batch(() => {
      time.value = 0
      isCountingDown.value = false
      isPaused.value = false
      isFinished.value = true
      isCancelled.value = true
      playBirds.value = false
    })
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    // Reset finished after delay
    setTimeout(() => {
        isFinished.value = false
        isCancelled.value = false
    }, 1000)
  }

  const handlePresetTime = (minutes: number) => {
    const newTime = minutes * 60
    batch(() => {
      time.value = newTime
      activePomodoro.value = minutes
      isPaused.value = true
      isFinished.value = false
      isCountingDown.value = false
    })
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  const startAdjustment = (direction: number, isMinutes: boolean) => {
     if (isCountingDown.value) {
       // Pause but don't trigger "pause" event/logic if we want adjustment to be smooth?
       // Original context: setIsPaused(true)
       if (timerInterval) {
          clearInterval(timerInterval)
          timerInterval = null
       }
       batch(() => {
         isCountingDown.value = false
         isPaused.value = true
       })
     } else {
        isPaused.value = true
     }

     const increment = isMinutes ? 60 : 1

     const adjust = () => {
       const newVal = time.peek() + (direction * increment)
       time.value = Math.max(0, Math.min(3600, newVal))
     }

     adjust()

     if (adjustInterval) clearInterval(adjustInterval)
     adjustInterval = setInterval(adjust, isMinutes ? 300 : 250)
  }

  const stopAdjustment = () => {
    if (adjustInterval) {
      clearInterval(adjustInterval)
      adjustInterval = null
    }
  }

  const restoreState = () => {
    if (typeof window === "undefined") return

    try {
        const raw = localStorage.getItem("timerState")
        if (raw) {
            const state = JSON.parse(raw) as TimerState
            // If it was counting down and not paused, catch up
            if (state.isCountingDown && !state.isPaused && state.startTime) {
                const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
                const remaining = Math.max(0, state.time - elapsed)

                batch(() => {
                    time.value = remaining
                    isCountingDown.value = true
                    isPaused.value = false
                    startTime.value = state.startTime
                })

                if (remaining > 0) {
                    startCountdown(remaining)
                } else {
                    handleTimerEnd()
                }
            } else {
                // Just restore values
                batch(() => {
                    time.value = state.time
                    isCountingDown.value = state.isCountingDown
                    isPaused.value = state.isPaused
                    isFinished.value = state.isFinished
                    if (state.startTime) startTime.value = state.startTime
                })
            }
        }
    } catch (e) {
        console.error("Error restoring timer state", e)
    }
  }

  // Persist full timer state
  effect(() => {
      if (typeof window === "undefined") return
      const state: TimerState = {
          time: time.value,
          isCountingDown: isCountingDown.value,
          isPaused: isPaused.value,
          isFinished: isFinished.value,
          startTime: startTime.value,
          timestamp: Date.now()
      }
      localStorage.setItem("timerState", JSON.stringify(state))
  })

  // Initialize persistence for presets
  syncStorage("presetMin1", presetMin1)
  syncStorage("presetMin2", presetMin2)
  syncStorage("presetMin3", presetMin3)
  syncStorage("startTime", startTime)
  syncStorage("selectedTasks", selectedTasks)

  return {
    time,
    isCountingDown,
    isPaused,
    isFinished,
    isCancelled,
    startTime,
    presetMin1,
    presetMin2,
    presetMin3,
    activePomodoro,
    playBirds,
    playKitasaku,
    replay,
    selectedTasks,

    startCountdown,
    pause,
    resume,
    cancel,
    handlePresetTime,
    startAdjustment,
    stopAdjustment,
    restoreState,

    dispose: () => {
        if (timerInterval) clearInterval(timerInterval)
        if (adjustInterval) clearInterval(adjustInterval)
    }
  }
}

export type TimerModel = ReturnType<typeof createTimerModel>
