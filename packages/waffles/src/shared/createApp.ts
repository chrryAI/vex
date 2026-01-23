import { Page, expect } from "@playwright/test"
import { getURL, modelName, wait, storeApps, getModelCredits } from ".."
import { chat } from "./chat"
import { clean } from "./clean"
import { grape } from "./grape"
import app from "./app"

const createApp = async ({
  app: appName,
  isRetro,
  slug,
  page,
  isLive,
  isMember,
  nav,
  isNewChat,
  creditsConsumed,
  messagesConsumed,
  isGrape,
  defaultAgent,
}: {
  app: string
  isRetro?: boolean
  slug: string
  page: Page
  isLive: boolean
  isMember: boolean
  isGrape?: boolean
  nav?: {
    name: string
    chat: {
      isRetro?: boolean
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
  isNewChat?: boolean
  creditsConsumed?: number
  messagesConsumed?: number
}) => {
  if (isNewChat) {
    await page.goto(getURL({ isLive, isMember }), {
      waitUntil: "networkidle",
      timeout: 100000,
    })
    await wait(5000) // Increased wait to ensure page is fully loaded
  }

  const capabilities = {
    chatGPT: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
      codeExecution: true,
    },
    claude: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
      codeExecution: true,
    },

    sushi: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: true,
      pdf: true,
      imageGeneration: true,
      codeExecution: true,
    },
    gemini: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
      codeExecution: true,
    },
    perplexity: {
      text: true,
      image: false,
      audio: false,
      video: false,
      webSearch: true,
      pdf: false,
      imageGeneration: false,
      codeExecution: false,
    },
  }

  const addAgentButton = page.getByTestId("add-agent-button")

  await expect(addAgentButton).toBeVisible()

  await addAgentButton.click()

  const nameInput = page.getByTestId("name-input")

  await expect(nameInput).toHaveValue("MyAgent")

  await nameInput.fill(appName)

  // Click System Prompt button
  const systemPromptButton = page.getByTestId("system-prompt-button")
  await expect(systemPromptButton).toBeVisible()
  await systemPromptButton.click()

  // Fill system prompt
  const systemPromptTextarea = page.getByTestId("system-prompt-textarea")
  await expect(systemPromptTextarea).toBeVisible()
  await systemPromptTextarea.fill(
    "You are a helpful AI assistant specialized in testing.",
  )

  // Click Continue button
  const continueButton = page.getByTestId("continue-button")
  await expect(continueButton).toBeVisible()
  await continueButton.click()

  await wait(2000)

  await app({
    app: appName,
    isRetro,
    slug,
    page,
    isLive,
    isMember,
    nav,
    isNewChat,
    creditsConsumed,
    messagesConsumed,
    isGrape,
  })
}

export default createApp
