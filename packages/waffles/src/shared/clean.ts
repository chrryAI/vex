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
    waitUntil: "domcontentloaded",
    timeout: 100000,
  })

  await maximize({ page })

  await wait(2000)

  const clearSessionButton = page.getByTestId("clear-session")

  await expect(clearSessionButton).toBeVisible({
    timeout: 20000,
  })

  await wait(2000)
  // First click to show confirm
  await clearSessionButton.click()

  await wait(2000)
  // Second click to confirm
  await clearSessionButton.click()

  await expect(page.getByTestId("is-deleted")).toBeAttached({
    timeout: 50000,
  })
  // Wait for the API call to complete
  await page.waitForTimeout(5000)
}
