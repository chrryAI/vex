// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import Search from "../Search"
import { PlatformProvider } from "../platform/PlatformProvider"

// Mock PlatformProvider to simulate desktop
vi.mock("../platform/PlatformProvider", async () => {
  const actual = await vi.importActual("../platform/PlatformProvider")
  return {
    ...actual,
    usePlatform: () => ({
      isWeb: true,
      isDesktop: true,
      isMobile: false,
    }),
  }
})

// Mock NavigationContext
vi.mock("../context/providers", () => ({
  useNavigationContext: () => ({
    addParams: vi.fn(),
  }),
}))

// Mock useWindowHistory hooks which Search uses directly
vi.mock("../hooks/useWindowHistory", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}))

describe("Search", () => {
  it("renders search input with accessibility features", async () => {
    const div = document.createElement("div")
    document.body.appendChild(div)
    const root = createRoot(div)

    await act(async () => {
      root.render(
        <PlatformProvider>
          <Search placeholder="Search docs" />
        </PlatformProvider>,
      )
    })

    const input = div.querySelector("input")
    expect(input).toBeTruthy()
    expect(input?.getAttribute("aria-label")).toBe("Search docs")
    expect(input?.getAttribute("placeholder")).toBe("Search docs")

    // Check for keyboard shortcut badge
    // We look for a span that contains ⌘K
    const spans = div.querySelectorAll("span")
    const badge = Array.from(spans).find((s) => s.textContent === "⌘K")
    expect(badge).toBeTruthy()

    // Test keyboard shortcut
    if (input) {
      const focusSpy = vi.spyOn(input, "focus")
      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
      })
      window.dispatchEvent(event)

      expect(focusSpy).toHaveBeenCalled()
    }

    await act(async () => {
      root.unmount()
    })
    div.remove()
  })
})
