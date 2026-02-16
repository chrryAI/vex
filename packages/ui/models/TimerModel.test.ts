import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createTimerModel } from "./TimerModel"

describe("TimerModel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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
})
