import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import React from "react"
import Checkbox from "../Checkbox"

// Mock the platform components since they might rely on React Native or other context
vi.mock("../platform", () => ({
  Div: ({ children, style, className, ...props }: any) => (
    <div style={style} className={className} {...props}>
      {children}
    </div>
  ),
  Input: React.forwardRef(({ style, ...props }: any, ref: any) => (
    <input ref={ref} style={style} {...props} />
  )),
  Label: ({ children, style, className, ...props }: any) => (
    <label style={style} className={className} {...props}>
      {children}
    </label>
  ),
  Span: ({ children, style, className, ...props }: any) => (
    <span style={style} className={className} {...props}>
      {children}
    </span>
  ),
}))

// Mock the styles hook
vi.mock("../Checkbox.styles", () => ({
  useCheckboxStyles: () => ({
    formSwitch: { style: {} },
    formSwitchTrack: { style: {} },
    formSwitchTrackChecked: { style: {} },
    formSwitchThumb: { style: {} },
    formSwitchThumbChecked: { style: {} },
    formSwitchLabel: { style: {} },
  }),
}))

describe("Checkbox", () => {
  it("renders correctly", () => {
    render(<Checkbox>Test Checkbox</Checkbox>)
    expect(screen.getByLabelText("Test Checkbox")).toBeTruthy()
  })

  it("handles click events", () => {
    const handleChange = vi.fn()
    render(<Checkbox onChange={handleChange}>Test Checkbox</Checkbox>)

    const checkbox = screen.getByLabelText("Test Checkbox")
    fireEvent.click(checkbox)

    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it("applies focus styles when focused", () => {
    render(<Checkbox dataTestId="test-checkbox">Test Checkbox</Checkbox>)

    const checkbox = screen.getByLabelText("Test Checkbox")
    // Find the track. It's inside the label (which is the parent of the input)
    // The input is found by label text. The parent is the label.
    // Inside the label, we look for the element with class formSwitchTrack
    // Since we mocked Div to render a div with the class, this works.
    const label = checkbox.parentElement
    const track = label?.querySelector(".formSwitchTrack") as HTMLElement

    // Initial state: no focus ring
    expect(track.style.boxShadow).toBe("")

    // Focus the checkbox
    fireEvent.focus(checkbox)

    // Focused state: focus ring applied
    // The style is: "0 0 0 2px var(--background), 0 0 0 4px var(--accent-0)"
    expect(track.style.boxShadow).toContain("var(--accent-0)")

    // Blur the checkbox
    fireEvent.blur(checkbox)

    // Blurred state: no focus ring
    expect(track.style.boxShadow).toBe("")
  })
})
