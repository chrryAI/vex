import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createTimerModel, TimerState } from "./TimerModel"

describe("TimerModel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("should initialize with default values", () => {
    const model = createTimerModel()
    expect(model.time.value).toBe(0)
    expect(model.isCountingDown.value).toBe(false)
    expect(model.isPaused.value).toBe(false)
    expect(model.isFinished.value).toBe(false)

    model.dispose()
  })

  it("should start countdown and tick", () => {
    const model = createTimerModel()
    model.startCountdown(60)

    expect(model.time.value).toBe(60)
    expect(model.isCountingDown.value).toBe(true)

    // Advance 1.1 seconds (interval is 100ms, but update logic uses Date.now())
    vi.advanceTimersByTime(1100)

    expect(model.time.value).toBe(59)

    model.dispose()
  })

  it("should pause and resume", () => {
    const model = createTimerModel()
    model.startCountdown(60)
    vi.advanceTimersByTime(1100)
    expect(model.time.value).toBe(59)

    model.pause()
    expect(model.isPaused.value).toBe(true)
    expect(model.isCountingDown.value).toBe(false)

    // Time should not change while paused
    vi.advanceTimersByTime(2000)
    expect(model.time.value).toBe(59)

    model.resume()
    expect(model.isPaused.value).toBe(false)
    expect(model.isCountingDown.value).toBe(true)

    vi.advanceTimersByTime(1100)
    expect(model.time.value).toBe(58)

    model.dispose()
  })

  it("should cancel timer", () => {
    const model = createTimerModel()
    model.startCountdown(60)

    model.cancel()

    expect(model.time.value).toBe(0)
    expect(model.isCountingDown.value).toBe(false)
    expect(model.isPaused.value).toBe(false)
    expect(model.isFinished.value).toBe(true)
    expect(model.isCancelled.value).toBe(true)

    // Check reset after delay
    vi.advanceTimersByTime(1000)
    expect(model.isFinished.value).toBe(false)
    expect(model.isCancelled.value).toBe(false)

    model.dispose()
  })

  it("should handle presets", () => {
    const model = createTimerModel()
    model.handlePresetTime(25)

    expect(model.time.value).toBe(25 * 60)
    expect(model.activePomodoro.value).toBe(25)
    expect(model.isPaused.value).toBe(true)

    model.dispose()
  })

  it("should handle time adjustment (increment)", () => {
    const model = createTimerModel()
    model.time.value = 60

    model.startAdjustment(1, false) // +1 second

    expect(model.isPaused.value).toBe(true)
    expect(model.time.value).toBe(61)

    // Interval check
    vi.advanceTimersByTime(300)
    expect(model.time.value).toBeGreaterThan(61)

    model.stopAdjustment()
    const stoppedTime = model.time.value
    vi.advanceTimersByTime(300)
    expect(model.time.value).toBe(stoppedTime)

    model.dispose()
  })

  it("should handle time adjustment (minutes)", () => {
    const model = createTimerModel()
    model.time.value = 60

    model.startAdjustment(1, true) // +1 minute

    expect(model.time.value).toBe(120)

    model.dispose()
  })

  it("should pause if adjusting while running", () => {
    const model = createTimerModel()
    model.startCountdown(60)
    expect(model.isCountingDown.value).toBe(true)

    model.startAdjustment(1, false)
    expect(model.isCountingDown.value).toBe(false)
    expect(model.isPaused.value).toBe(true)

    model.dispose()
  })

  it("should finish timer when time reaches 0", () => {
    const model = createTimerModel()
    model.startCountdown(1)

    expect(model.isCountingDown.value).toBe(true)

    vi.advanceTimersByTime(1100) // > 1 sec

    expect(model.time.value).toBe(0)
    expect(model.isFinished.value).toBe(true)
    expect(model.isCountingDown.value).toBe(false)

    model.dispose()
  })

  it("should auto-replay if enabled", () => {
    const model = createTimerModel()
    model.replay.value = true
    model.presetMin1.value = 5

    model.startCountdown(1)
    vi.advanceTimersByTime(1100)

    expect(model.isFinished.value).toBe(true)

    // Wait for replay delay (1000ms)
    vi.advanceTimersByTime(1000)

    expect(model.isFinished.value).toBe(false)
    expect(model.isCountingDown.value).toBe(true)
    expect(model.time.value).toBe(5 * 60)

    model.dispose()
  })

  it("should restore state from localStorage (not running)", () => {
    const now = Date.now()
    const savedState: TimerState = {
        time: 100,
        isCountingDown: false,
        isPaused: true,
        isFinished: false,
        startTime: now,
        timestamp: now
    }
    localStorage.setItem("timerState", JSON.stringify(savedState))

    const model = createTimerModel()
    // No need to call restoreState() as it's done on initialization

    expect(model.time.value).toBe(100)
    expect(model.isPaused.value).toBe(true)
    expect(model.isCountingDown.value).toBe(false)

    model.dispose()
  })

  it("should restore state from localStorage (running and catch up)", () => {
    const now = Date.now()
    const startTime = now - 10000 // 10 seconds ago
    const savedState: TimerState = {
        time: 60, // Was 60s when saved
        isCountingDown: true,
        isPaused: false,
        isFinished: false,
        startTime: startTime,
        timestamp: startTime
    }
    localStorage.setItem("timerState", JSON.stringify(savedState))

    // Ensure system time matches what we expect for the calculation
    vi.setSystemTime(now)

    const model = createTimerModel()

    // Should have elapsed 10s: 60 - 10 = 50
    expect(model.time.value).toBe(50)
    expect(model.isCountingDown.value).toBe(true)
    expect(model.isPaused.value).toBe(false)

    model.dispose()
  })

  it("should sync changes to localStorage", async () => {
    const model = createTimerModel()

    // Initial state write happens immediately
    // Wait a tick
    await vi.waitFor(() => {
        expect(localStorage.getItem("timerState")).toBeTruthy()
    })

    model.time.value = 123

    // Verify update
    await vi.waitFor(() => {
        const stored = localStorage.getItem("timerState")
        if (stored) {
            const state = JSON.parse(stored)
            expect(state.time).toBe(123)
        }
    })

    model.dispose()
  })

  it("should load persisted presets", () => {
    localStorage.setItem("presetMin1", "30")

    const model = createTimerModel()
    expect(model.presetMin1.value).toBe(30)

    model.dispose()
  })

  it("should sync cross-tab storage events", () => {
    const model = createTimerModel()

    // Simulate storage event
    const event = new StorageEvent("storage", {
        key: "presetMin1",
        newValue: "45",
        oldValue: "25",
        storageArea: localStorage
    })
    window.dispatchEvent(event)

    expect(model.presetMin1.value).toBe(45)

    model.dispose()
  })
})
