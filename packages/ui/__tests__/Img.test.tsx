import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import Img from "../Img"

// Mock the platform imports
vi.mock("../platform", () => ({
  MotiView: ({ children }: any) => <div>{children}</div>,
  Image: (props: any) => <img alt="mock" {...props} />,
  Span: ({ children, style, className }: any) => (
    <span style={style} className={className}>
      {children}
    </span>
  ),
  useTheme: () => ({ reduceMotion: true }),
}))

// Mock useInView
vi.mock("../platform/useInView", () => ({
  useInView: ({ skip }: { skip?: boolean }) => ({
    ref: vi.fn(),
    inView: true,
  }),
}))

describe("Img component", () => {
  it("renders correctly and starts loading", async () => {
    // We need to properly mock the Image constructor in the global window object
    // since vitest uses happy-dom which has a real Image constructor
    const originalImage = window.Image
    const decodeMock = vi.fn().mockResolvedValue(undefined)
    window.Image = class {
      src = ""
      width = 100
      height = 100
      decode = decodeMock
    } as any

    render(
      <Img src="https://example.com/test.jpg" alt="test image" width={100} />,
    )

    await waitFor(() => {
      expect(decodeMock).toHaveBeenCalled()
      // Because we mocked PlatformImage (Image from ../platform) as <img alt="mock" {...props} />
      expect(screen.getByAltText("test image")).toBeDefined()
    })

    window.Image = originalImage
  })

  it("prioritizes loading when priority prop is true", async () => {
    const originalImage = window.Image
    const decodeMock = vi.fn().mockResolvedValue(undefined)
    window.Image = class {
      src = ""
      width = 100
      height = 100
      decode = decodeMock
    } as any

    render(
      <Img
        src="https://example.com/priority.jpg"
        alt="priority image"
        width={100}
        priority
      />,
    )

    await waitFor(() => {
      expect(decodeMock).toHaveBeenCalled()
      expect(screen.getByAltText("priority image")).toBeDefined()
    })

    window.Image = originalImage
  })

  it("handles dimensions change callback", async () => {
    const originalImage = window.Image
    const decodeMock = vi.fn().mockResolvedValue(undefined)
    window.Image = class {
      src = ""
      width = 150
      height = 150
      decode = decodeMock
    } as any
    const handleDimensionsChange = vi.fn()

    render(
      <Img
        src="https://example.com/dim.jpg"
        alt="dim image"
        width={150}
        handleDimensionsChange={handleDimensionsChange}
      />,
    )

    await waitFor(() => {
      expect(decodeMock).toHaveBeenCalled()
      expect(handleDimensionsChange).toHaveBeenCalledWith({
        width: 150,
        height: 150,
      })
    })

    window.Image = originalImage
  })

  it("handles decode error gracefully", async () => {
    const originalImage = window.Image
    const decodeMock = vi.fn().mockRejectedValue(new Error("Decode failed"))
    window.Image = class {
      src = ""
      decode = decodeMock
    } as any

    render(
      <Img
        src="https://example.com/error.jpg"
        width={100}
        showLoading={true}
      />,
    )

    await waitFor(() => {
      expect(decodeMock).toHaveBeenCalled()
      expect(screen.queryByAltText("error.jpg")).toBeNull()
    })

    window.Image = originalImage
  })
})
