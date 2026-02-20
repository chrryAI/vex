// @vitest-environment happy-dom

import { act, fireEvent, render } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

global.React = React

import FocusButton from "../FocusButton"

// Mock platform components
vi.mock("../platform", async () => {
  return {
    Button: ({ children, className, style, onClick, onKeyDown, "aria-label": ariaLabel, ...props }: any) => (
      <button
        className={className}
        style={style}
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </button>
    ),
    Div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
    Input: ({ ...props }: any) => <input {...props} />,
    Video: ({ ...props }: any) => <video {...props} />,
    usePlatform: () => ({ os: "web", isExtension: false }),
    useTheme: () => ({ enableSound: true, setEnableSound: vi.fn(), setTheme: vi.fn() }),
    useKeepAwake: vi.fn(),
    DraggableList: () => null,
    ThemeSwitcher: () => null,
    GitHubConnectButton: () => null,
    Checkbox: () => null,
    A: () => null,
  }
})

// Mock icons
vi.mock("../icons", () => ({
  AlarmClockCheck: () => null,
  Bird: () => null,
  ChevronDown: () => null,
  ChevronUp: () => null,
  Circle: () => null,
  CircleCheck: () => null,
  CirclePause: () => null,
  CirclePlay: () => null,
  CircleX: () => null,
  CloudDownload: () => null,
  GripVertical: () => null,
  Repeat: () => null,
  SettingsIcon: () => null,
  Trash2: () => null,
}))

// Mock styles
vi.mock("../FocusButton.styles", () => ({
  useFocusButtonStyles: () => ({
    greeting: { style: {} },
    main: { style: {} },
    pomodoro: { style: {} },
    timeAdjust: { style: {} },
    focusButton: { style: {} },
    focusButtonMounted: { style: {} },
    focusButtonCounting: { style: {} },
    focusButtonFinished: { style: {} },
    videoContainer: { style: {} },
    letsFocusContainer: { style: {} },
    videoPlay: { style: {} },
    videoPause: { style: {} },
    video: { style: {} },
    userName: { style: {} },
    headerContainer: { style: {} },
    showSettings: { style: {} },
    timeDisplay: { style: {} },
    time: { style: {} },
    separator: { style: {} },
    footerContainer: { style: {} },
    controls: { style: {} },
    controlIcon: { style: {} },
    pauseButton: { style: {} },
    cancelButton: { style: {} },
    selectedTask: { style: {} },
    selectedTaskCounting: { style: {} },
    selectedTaskPaused: { style: {} },
    selectedTaskFinished: { style: {} },
    task: { style: {} },
    taskContent: { style: {} },
    taskTitle: { style: {} },
    taskSelected: { style: {} },
    taskNotSelected: { style: {} },
    taskTime: { style: {} },
    dragHandle: { style: {} },
    closeSettingsButton: { style: {} },
    settings: { style: {} },
    settingsSpan: { style: {} },
    additionalSettings: { style: {} },
    settingsFooter: { style: {} },
    discord: { style: {} },
    x: { style: {} },
    settingsContainer: { style: {} },
    taskSection: { style: {} },
    top: { style: {} },
    newTaskButton: { style: {} },
    loadingTasks: { style: {} },
    app: { style: {} },
    tasks: { style: {} },
    greatStart: { style: {} },
    testimonials: { style: {} },
    active: { style: {} },
    focusButtonPaused: { style: {} },
  }),
}))

vi.mock("../context/StylesContext", () => ({
  useStyles: () => ({
    utilities: {
      transparent: { style: {} },
      link: { style: {} },
      small: { style: {} },
      inverted: { style: {} },
      button: { style: {} },
    },
  }),
}))

// Mock context providers
const mockTimerContext = {
  time: 1500, // 25 mins
  presetMin1: 25,
  presetMin2: 15,
  presetMin3: 5,
  activePomodoro: 25,
  isCountingDown: false,
  isPaused: false,
  isFinished: false,
  playBirds: false,
  replay: false,
  isLoadingTasks: false,
  tasks: { tasks: [] },
  startAdjustment: vi.fn(),
  stopAdjustment: vi.fn(),
  startCountdown: vi.fn(),
  handlePause: vi.fn(),
  handleResume: vi.fn(),
  handleCancel: vi.fn(),
  handlePresetTime: vi.fn(),
  setPlayBirds: vi.fn(),
  setReplay: vi.fn(),
  fetchTasks: vi.fn(),
  playKitasaku: false,
  setPlayKitasaku: vi.fn(),
  setTime: vi.fn(),
  selectedTasks: [],
  setSelectedTasks: vi.fn(),
  setPresetMin1: vi.fn(),
  setPresetMin2: vi.fn(),
  setPresetMin3: vi.fn(),
  remoteTimer: null,
}

vi.mock("../context/providers", () => ({
  useAuth: () => ({
    token: "token",
    plausible: vi.fn(),
    user: { name: "User" },
    loadingApp: null,
    baseApp: null,
    focus: null,
    app: null,
    storeApps: [],
    getAppSlug: vi.fn(),
    enableNotifications: false,
    setEnableNotifications: vi.fn(),
    setShowFocus: vi.fn(),
  }),
  useChat: () => ({
    setPlaceHolderText: vi.fn(),
    placeHolderText: "",
    setShouldFocus: vi.fn(),
    setIsNewAppChat: vi.fn(),
  }),
  useNavigationContext: () => ({
    searchParams: new URLSearchParams(),
    addParams: vi.fn(),
    push: vi.fn(),
    removeParams: vi.fn(),
  }),
}))

vi.mock("../context/TimerContext", () => ({
  useTimerContext: () => mockTimerContext,
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Mock other components
vi.mock("../SwipeableTimeControl", () => ({
  default: ({ Up, Down, value }: any) => (
    <div>
      {Up}
      <span>{value}</span>
      {Down}
    </div>
  ),
}))

vi.mock("../hooks", () => ({
  useHasHydrated: () => true,
}))

// Mock sub-components
vi.mock("../addTask/AddTask", () => ({ default: () => null }))
vi.mock("../Checkbox", () => ({ default: () => null }))
vi.mock("../ConfirmButton", () => ({ default: () => null }))
vi.mock("../GitHubConnectButton", () => ({ default: () => null }))
vi.mock("../Image", () => ({ default: () => null }))
vi.mock("../Loading", () => ({ default: () => null }))
vi.mock("../Testimonials", () => ({ default: () => null }))
vi.mock("../ThemeSwitcher", () => ({ default: () => null }))
vi.mock("../a/A", () => ({ default: () => null }))

describe("FocusButton", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("calls startAdjustment and stopAdjustment when Enter is pressed on Minutes Up button", () => {
    vi.useFakeTimers()
    const { getByLabelText } = render(<FocusButton />)
    const minutesUp = getByLabelText("Increase minutes")

    fireEvent.keyDown(minutesUp, { key: "Enter" })

    expect(mockTimerContext.startAdjustment).toHaveBeenCalledWith(1, true)

    vi.advanceTimersByTime(100)
    expect(mockTimerContext.stopAdjustment).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("renders Let's focus as a button with correct aria-label", () => {
    const { getByLabelText } = render(<FocusButton />)
    const letsFocusBtn = getByLabelText("Play Kitasaku video")

    expect(letsFocusBtn.tagName).toBe("BUTTON")
    expect(letsFocusBtn.className).toContain("link")

    fireEvent.click(letsFocusBtn)
    expect(mockTimerContext.setPlayKitasaku).toHaveBeenCalledWith(true)
  })
})
