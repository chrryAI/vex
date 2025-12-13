import * as dotenv from "dotenv"
import { Page } from "@playwright/test"

export type modelName = "chatGPT" | "claude" | "gemini" | "sushi" | "perplexity"

export const TEST_GUEST_FINGERPRINTS =
  process.env.TEST_GUEST_FINGERPRINTS?.split(",") || []
export const TEST_MEMBER_FINGERPRINTS =
  process.env.TEST_MEMBER_FINGERPRINTS?.split(",") || []
export const TEST_MEMBER_EMAILS =
  process.env.TEST_MEMBER_EMAILS?.split(",") || []

export const VEX_TEST_EMAIL = process.env.VEX_TEST_EMAIL!
export const VEX_TEST_PASSWORD = process.env.VEX_TEST_PASSWORD!
export const VEX_TEST_FINGERPRINT = TEST_MEMBER_FINGERPRINTS[0]
export const VEX_TEST_EMAIL_2 = process.env.VEX_TEST_EMAIL_2!
export const VEX_TEST_PASSWORD_2 = process.env.VEX_TEST_PASSWORD_2!
export const VEX_TEST_FINGERPRINT_2 = TEST_MEMBER_FINGERPRINTS[1]
export const VEX_TEST_EMAIL_3 = process.env.VEX_TEST_EMAIL_3!
export const VEX_TEST_PASSWORD_3 = process.env.VEX_TEST_PASSWORD_3!
export const VEX_TEST_FINGERPRINT_3 = TEST_MEMBER_FINGERPRINTS[2]

dotenv.config()

export const TEST_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.TEST_URL!
export const LIVE_URL = "https://chrry.ai"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const isCI = process.env.NEXT_PUBLIC_CI || process.env.CI

const getURL = (
  {
    isLive = false,
    isMember = false,
    path = "",
    fingerprint = "",
  }: {
    isLive: boolean
    isMember?: boolean
    path?: string
    fingerprint?: string
  } = {
    isLive: false,
    isMember: false,
    path: "",
    fingerprint: "",
  },
) => {
  const base = isLive ? LIVE_URL : TEST_URL
  const url = isMember
    ? `${base}${path}?fp=${fingerprint || TEST_MEMBER_FINGERPRINTS[0]}`
    : `${base}${path}?fp=${fingerprint || TEST_GUEST_FINGERPRINTS[0]}`

  console.log(`🚀 ~ url:`, url)
  return url
}

const simulateInputPaste = async (page: Page, text: string) => {
  await page.evaluate((content) => {
    const textarea = document.querySelector(
      'textarea[data-testid="chat-textarea"]',
    ) as HTMLTextAreaElement
    if (!textarea) return

    // Create a basic event
    const pasteEvent = new Event("paste", {
      bubbles: true,
      cancelable: true,
    })

    // Add clipboardData getter
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        getData: () => content,
        types: ["text/plain"],
        files: [],
        items: [
          {
            kind: "string",
            type: "text/plain",
            getAsString: (callback: (text: string) => void) =>
              callback(content),
          },
        ],
      },
      writable: false,
    })

    // Dispatch the event
    textarea.dispatchEvent(pasteEvent)

    // Set the value directly after the paste event
    textarea.value = content

    // Trigger input event to simulate actual typing
    const inputEvent = new Event("input", { bubbles: true })
    textarea.dispatchEvent(inputEvent)
  }, text)
}

const simulatePaste = async (page: Page, text: string) => {
  // Use Playwright's built-in clipboard API
  await page.evaluate(async (content) => {
    // Write to clipboard
    await navigator.clipboard.writeText(content)

    // Find the paste button and click it
    const pasteButton = document.querySelector(
      '[data-testid*="artifacts-paste-button"]',
    ) as HTMLButtonElement
    if (pasteButton) {
      pasteButton.click()
    }
  }, text)
}

function capitalizeFirstLetter(val: string) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1)
}

const logs = new Map<string, number>() // msg → timestamp
export const log = ({ page }: { page: Page }) => {
  page.on("console", (msg) => {
    const now = Date.now()
    const lastSeen = logs.get(msg.text())

    // Only skip if seen within last 5 seconds
    if (lastSeen && now - lastSeen < 5000) return

    console.log(`[browser][${msg.type()}] ${msg.text()}`)
    logs.set(msg.text(), now)
  })
}

export {
  wait,
  getURL,
  simulateInputPaste,
  simulatePaste,
  capitalizeFirstLetter,
}
