import { Page, expect } from "@playwright/test"
import { getURL, modelName, wait, storeApps, getModelCredits } from ".."
import { chat } from "./chat"
import { clean } from "./clean"

const app = async ({
  slug,
  page,
  isLive,
  isMember,
  nav,
  isNewChat,
}: {
  slug: string
  page: Page
  isLive: boolean
  isMember: boolean
  nav: {
    name: string
    chat: {
      instruction?: string
      prompts?: {
        model?: modelName
        stop?: boolean
        text: string
        agentMessageTimeout?: number
        webSearch?: boolean
        delete?: boolean
        mix?: {
          image?: number
          video?: number
          audio?: number
          paste?: number
          pdf?: number
        }
      }[]
      agentMessageTimeout?: number
      isNewChat?: boolean
      isLive?: boolean
      threadId?: string
      creditsConsumed?: number
      messagesConsumed?: number
      bookmark?: boolean
    }
  }[]
  isNewChat: boolean
}) => {
  if (isNewChat) {
    await page.goto(getURL({ isLive, isMember }), {
      waitUntil: "networkidle",
      timeout: 100000,
    })
    await wait(3000)
  }

  if (slug !== "chrry") {
    const chrry = page.getByTestId(`app-chrry`)
    expect(chrry).toBeVisible()
  }

  const storeAppButton = page.getByTestId(`store-app-${slug}`)

  expect(storeAppButton).not.toBeVisible()

  // Track cumulative credits and messages consumed across all apps
  let totalCreditsConsumed = 0
  let totalMessagesConsumed = 0

  for (const item of nav) {
    const appButton = page.getByTestId(`app-${item.name}`)
    await expect(appButton).toBeVisible()

    await appButton.click()

    const isStoreApp = storeApps.includes(item.name)

    await expect(storeAppButton).toBeVisible({
      visible: !isStoreApp,
      timeout: 5000,
    })

    await expect(appButton).not.toBeVisible()

    if (!isStoreApp) {
      await storeAppButton.click()

      await expect(storeAppButton).not.toBeVisible({
        timeout: 5000,
      })
      await expect(appButton).toBeVisible({
        timeout: 5000,
      })

      await appButton.click()

      await expect(appButton).not.toBeVisible({
        timeout: 5000,
      })

      await expect(storeAppButton).toBeVisible({
        timeout: 5000,
      })
    }

    await chat({
      page,
      isMember,
      isLive,
      isNewChat: false,
      threadId: item.chat.threadId,
      creditsConsumed: totalCreditsConsumed, // Use cumulative total
      messagesConsumed: totalMessagesConsumed, // Use cumulative total
      bookmark: item.chat.bookmark ?? false,
      prompts: item.chat.prompts,
    })

    // Add this app's credits and messages to the running totals
    const creditsForThisApp =
      item.chat.prompts?.reduce(
        (total, prompt) => total + getModelCredits(prompt.model || "sushi"),
        0,
      ) || 0
    const messagesForThisApp = item.chat.prompts?.length || 0

    totalCreditsConsumed += creditsForThisApp
    totalMessagesConsumed += messagesForThisApp

    const menuHomeButton = page.getByTestId("menu-home-button")
    await expect(menuHomeButton).toBeVisible()
    await menuHomeButton.click()
    await expect(storeAppButton).toBeVisible({
      visible: !isStoreApp,
      timeout: 5000,
    })
  }
}

export default app
