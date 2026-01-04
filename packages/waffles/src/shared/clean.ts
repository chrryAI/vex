import { Page, expect } from "@playwright/test"
import { getURL } from "../index"

export async function clean({
  page,
  fingerprint,
  isLive,
  isMember,
}: {
  page: Page
  fingerprint?: string
  isLive?: boolean
  isMember?: boolean
}) {
  await page.goto(getURL({ isLive, isMember, fingerprint }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  const clearSessionButton = page.getByTestId("clear-session")

  await expect(clearSessionButton).toBeVisible({
    timeout: 20000,
  })
  // First click to show confirm
  await clearSessionButton.click()
  // Second click to confirm
  await clearSessionButton.click()
  // Wait for the API call to complete
  await page.waitForTimeout(5000)
}
