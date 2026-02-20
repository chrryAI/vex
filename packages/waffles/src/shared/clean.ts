import { expect, type Page } from "@playwright/test"
import { getURL, wait } from "../index"
import { signIn } from "../shared/signIn"

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
  waitForDelete = true,
}: {
  page: Page
  fingerprint?: string
  isLive?: boolean
  isMember?: boolean
  waitForDelete?: boolean
}) {
  await page.goto(getURL({ isLive, isMember, fingerprint }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await signIn({ page })

  await page.getByTestId("new-chat-button").click()

  await maximize({ page })

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
  waitForDelete
    ? await expect(page.getByTestId("is-deleted")).toBeAttached({
        timeout: 50000,
      })
    : await wait(5000)

  const accountButton = page.getByTestId("account-button")
  await expect(accountButton).toBeVisible({
    timeout: 50000,
  })

  await wait(5000)

  await accountButton.click()

  const logoutButton = page.getByTestId("account-logout-button")
  await expect(logoutButton).toBeVisible()

  await logoutButton.click()

  await expect(signInButton).toBeVisible({
    timeout: 15000,
  })

  // Wait for the API call to complete
  await page.waitForTimeout(5000)
}
