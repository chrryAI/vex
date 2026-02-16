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
  isCancelled?: boolean
  startTime: number
  timestamp?: number
}

export function createTimerModel() {
  // Helper to read initial state
  const getInitialState = (): TimerState => {
    if (typeof window === "undefined") {
      return {
        time: 0,
        isCountingDown: false,
        isPaused: false,
        isFinished: false,
        isCancelled: false,
        startTime: 0,
      }
    }
    try {
      const raw = localStorage.getItem("timerState")
      if (raw) {
        const state = JSON.parse(raw) as TimerState
        // Catch up logic
        if (state.isCountingDown && !state.isPaused && state.startTime) {
          const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
          const remaining = Math.max(0, state.time - elapsed)
          return {
            ...state,
            time: remaining,
            isFinished: remaining === 0 && state.time > 0, // Mark finished if it ended while closed
            isCountingDown: remaining > 0, // Stop counting if finished
          }
        }
        return state
      }
    } catch (e) {
      console.error("Error restoring timer state", e)
    }
    return {
      time: 0,
      isCountingDown: false,
      isPaused: false,
      isFinished: false,
      isCancelled: false,
      startTime: 0,
    }
  }

  const initialState = getInitialState()

  // Signals
  const time = signal(initialState.time)
  const isCountingDown = signal(initialState.isCountingDown)
  const isPaused = signal(initialState.isPaused)
  const isFinished = signal(initialState.isFinished)
  const isCancelled = signal(initialState.isCancelled || false)
  const startTime = signal(initialState.startTime)

  const presetMin1 = signal(25)
  const presetMin2 = signal(15)
  const presetMin3 = signal(5)

  const activePomodoro = signal<number | null>(null)

  const playBirds = signal(false)
  const playKitasaku = signal(false)
  const replay = signal(false)

  const selectedTasks = signal<Task[] | undefined>(undefined)

  let timerInterval: any = null
  let adjustInterval: any = null

  // Resume countdown if initialized in running state
  if (initialState.isCountingDown && initialState.time > 0) {
    // Need to start the interval
    // We can't call startCountdown here because it resets start time.
    // We implement a resume logic without batch reset.
    // Or just call startCountdown with current time?
    // startCountdown sets startTime to Date.now(), which is fine for resume.
    // But we want to preserve the original startTime?
    // Actually, if we just calculated remaining time, we can treat it as a new start for the interval loop.
    // But `startTime` signal should probably reflect the *original* start time if we want accurate drift correction?
    // The current startCountdown resets startTime.
    // Let's just defer starting the interval to an effect or call it.
    // Since this is initialization, we can't call methods easily before returning object.
    // But we can set a flag or run a setup function.
  }

  // Helper for persistence (presets)
  const syncStorage = <T>(
    key: string,
    s: any,
    parser: (v: string) => T = JSON.parse,
  ) => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(key)
        if (stored !== null) {
          s.value = parser(stored)
        }
      } catch (e) {
        console.error(`Failed to load ${key}`, e)
      }

      const handleStorage = (e: StorageEvent) => {
        if (e.key === key && e.newValue) {
          try {
            s.value = parser(e.newValue)
          } catch (error) {
            console.error(`Failed to parse ${key} from storage event`, error)
          }
        } else if (e.key === key && !e.newValue) {
          s.value = undefined
        }
      }
      window.addEventListener("storage", handleStorage)
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
      const newVal = time.peek() + direction * increment
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

  // Deprecated: State is restored on initialization
  const restoreState = () => {
    // Re-run getInitialState logic for manual sync if needed
    const state = getInitialState()
    batch(() => {
      time.value = state.time
      isCountingDown.value = state.isCountingDown
      isPaused.value = state.isPaused
      isFinished.value = state.isFinished
      isCancelled.value = state.isCancelled || false
      startTime.value = state.startTime
    })
    if (state.isCountingDown && state.time > 0) {
      startCountdown(state.time)
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
      isCancelled: isCancelled.value,
      startTime: startTime.value,
      timestamp: Date.now(),
    }
    localStorage.setItem("timerState", JSON.stringify(state))
  })

  // Start interval if initialized in running state
  if (initialState.isCountingDown && initialState.time > 0) {
    startCountdown(initialState.time)
  }

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
    },
  }
}

export type TimerModel = ReturnType<typeof createTimerModel>
