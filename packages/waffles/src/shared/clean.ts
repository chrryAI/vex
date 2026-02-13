import { Page, expect } from "@playwright/test"
import { getURL, wait } from "../index"

export async function maximize({ page }: { page: Page }) {
  await wait(2000)
  const max = page.getByTestId("maximize")
  const isVisible = await max.isVisible()
  isVisible && (await max.click())
}

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

  await maximize({ page })

  await page.goto(getURL({ isLive, isMember, fingerprint }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await wait(500)

  const clearSessionButton = page.getByTestId("clear-session")

  await expect(clearSessionButton).toBeVisible({
    timeout: 20000,
  })

  // First click to show confirm
  await clearSessionButton.click()

  await wait(500)

  // Second click to confirm
  await clearSessionButton.click()

  // unstable
  await expect(page.getByTestId("is-deleted")).toBeAttached({
    timeout: 50000,
  })

  // Wait for the API call to complete
  await page.waitForTimeout(5000)
}
