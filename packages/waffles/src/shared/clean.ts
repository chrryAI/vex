import { Page } from "@playwright/test"

export async function clean({ page }: { page: Page }) {
  try {
    const clearSessionButton = page.getByTestId("clear-session")
    if (await clearSessionButton.isVisible({ timeout: 2000 })) {
      // First click to show confirm
      await clearSessionButton.click()
      // Second click to confirm
      await clearSessionButton.click()
      // Wait for the API call to complete
      await page.waitForTimeout(1000)
    }
  } catch {
    // Button not visible, skip cleanup
  }
}
