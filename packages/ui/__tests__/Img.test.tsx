// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import Img from "../Img"
import { PlatformProvider } from "../platform/PlatformProvider"
import { ThemeProvider } from "../context/ThemeContext"

// Mock useInView to always be in view
vi.mock("../platform/useInView", () => ({
  useInView: () => ({
    ref: { current: null },
    inView: true,
  }),
}))

// Mock fetch to ensure it's NOT called
global.fetch = vi.fn()

describe("Img", () => {
  let container: HTMLDivElement | null = null
  let root: any = null
  let originalImage: any

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    originalImage = window.Image
  })

  afterEach(() => {
    if (root) {
      act(() => root.unmount())
    }
    if (container) {
      container.remove()
    }
    window.Image = originalImage
  })

  it("loads image using new Image() and decode() on web", async () => {
    // Mock Image
    const decodeMock = vi.fn().mockResolvedValue(undefined)

    // We need to capture the instance to verify src
    let imgInstance: any

    window.Image = class {
      src = ""
      width = 200
      height = 100
      decode = decodeMock
      constructor() {
        imgInstance = this
      }
    } as any

    const handleDimensionsChange = vi.fn()
    const onLoad = vi.fn()
    const url = "https://example.com/image.jpg"

    await act(async () => {
      root.render(
        <PlatformProvider>
          <ThemeProvider>
            <Img
              src={url}
              width={200}
              height={100}
              handleDimensionsChange={handleDimensionsChange}
              onLoad={onLoad}
            />
          </ThemeProvider>
        </PlatformProvider>,
      )
    })

    // Wait for promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Verify fetch was NOT called
    expect(global.fetch).not.toHaveBeenCalled()

    // Verify Image was created and decode called
    expect(decodeMock).toHaveBeenCalled()
    expect(imgInstance.src).toBe(url)

    // Verify rendered output
    // The component renders a PlatformImage inside MotiView
    // PlatformImage -> Image -> img
    const imgTag = container?.querySelector("img")
    expect(imgTag).toBeTruthy()
    expect(imgTag?.getAttribute("src")).toBe(url)

    // Manually trigger load event on the img tag to fire the onLoad callback
    act(() => {
      imgTag?.dispatchEvent(new Event("load"))
    })

    // Verify callbacks
    expect(handleDimensionsChange).toHaveBeenCalledWith({
      width: 200,
      height: 100,
    })
    expect(onLoad).toHaveBeenCalled()
  })

  it("handles loading error gracefully", async () => {
    // Mock decode failure
    const decodeMock = vi.fn().mockRejectedValue(new Error("Decode failed"))

    window.Image = class {
      src = ""
      width = 0
      height = 0
      decode = decodeMock
      constructor() {}
    } as any

    const url = "https://example.com/broken.jpg"

    await act(async () => {
      root.render(
        <PlatformProvider>
          <ThemeProvider>
            <Img src={url} width={200} height={100} />
          </ThemeProvider>
        </PlatformProvider>,
      )
    })

    // Wait for promises
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Verify decode called
    expect(decodeMock).toHaveBeenCalled()

    // Verify no image rendered (because error swallowed and imageSrc not set)
    const imgTag = container?.querySelector("img")
    expect(imgTag).toBeFalsy()

    // Verify loading spinner is gone (setIsLoading(false) was called)
    // Note: Loading component in this project might use data-testid="imgLoading" or class="spinner"
    const spinner = container?.querySelector("[data-testid='imgLoading']")
    expect(spinner).toBeFalsy()
  })
})
