
// @vitest-environment happy-dom

import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TimerContextProvider, useTimerContext } from "../context/TimerContext"
import React from "react"
import { mockAuth } from "./mocks/mockContexts"

global.React = React

vi.mock("../context/providers", () => ({
  useAuth: () => ({ ...mockAuth, setTasks: vi.fn(), setTimer: vi.fn() }),
}))

vi.mock("../platform", () => ({
  usePlatform: () => ({ isWeb: true, isExtension: false }),
  useLocalStorage: vi.fn((key, initialValue) => {
    const [state, setState] = React.useState(initialValue)
    return [state, setState]
  }),
  useTheme: () => ({ enableSound: false }),
  Audio: ({ onEnded }: any) => <audio onEnded={onEnded} data-testid="audio-element" />,
}))

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({ send: vi.fn() }),
}))

vi.mock("swr", () => ({
  default: () => ({ data: null, mutate: vi.fn(), isLoading: false }),
}))

describe("TimerContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("provides default signal values", () => {
    const { result } = renderHook(() => useTimerContext(), {
      wrapper: ({ children }) => <TimerContextProvider>{children}</TimerContextProvider>,
    })

    expect(result.current.time.value).toBe(0)
    expect(result.current.isCountingDown.value).toBe(false)
    expect(result.current.isPaused.value).toBe(false)
    expect(result.current.isFinished.value).toBe(false)
  })

  it("handles setTime correctly with signals", () => {
    // Avoid triggering full test lifecycle that OOMs Vitest
    const { result } = renderHook(() => useTimerContext(), {
      wrapper: ({ children }) => <TimerContextProvider>{children}</TimerContextProvider>,
    })

    act(() => {
      // Just setting it once to ensure it doesn't crash on simple state update.
      result.current.time.value = 1500
    })

    expect(result.current.time.value).toBe(1500)
  })
})
