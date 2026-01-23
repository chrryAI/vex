import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { clean } from "./shared/clean"
import {
  getURL,
  wait,
  VEX_TEST_EMAIL_3,
  VEX_TEST_PASSWORD_3,
  VEX_TEST_EMAIL_4,
} from "."
import { subscribe } from "./shared/subscribe"
import { collaboration } from "./shared/collaboration"
import { thread } from "./shared/thread"
import { v4 as uuidv4 } from "uuid"
import app from "./shared/app"
import createApp from "./shared/createApp"

const isMember = false

const isLive = true
test.beforeEach(async ({ page }) => {
  await clean({ page, isLive })
})

test("Subscribe As Guest", async ({ page }) => {
  await page.goto(
    getURL({
      isMember,
      isLive,
    }),
    {
      waitUntil: "networkidle",
      timeout: 100000,
    },
  )
  await wait(2000)

  await subscribe({
    page,
    isMember,
    // createChat: false,
  })
})

test("Invite", async ({ page }) => {
  await page.goto(
    getURL({
      isLive,
      isMember,
    }),
    {
      waitUntil: "networkidle",
      timeout: 100000,
    },
  )
  await subscribe({
    page,
    isMember,
    invite: `${uuidv4()}@gmail.com`,
    createChat: false,
  })
})

test("Gift", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await page.goto(
    getURL({
      isLive,
      isMember,
    }),
    {
      waitUntil: "networkidle",
      timeout: 100000,
    },
  )
  await subscribe({
    page,
    isMember,
    email: VEX_TEST_EMAIL_3!,
    password: VEX_TEST_PASSWORD_3!,
    gift: VEX_TEST_EMAIL_3!,
  })
})

test("Long text", async ({ page }) => {
  const result = await chat({
    page,
    isMember,
    isLive,
    instruction: "Help me write a short story",
    // agentMessageTimeout: 12000,
    prompts: [
      {
        text: "Write a 300-word story about a time traveler who discovers they can't change the past",
        model: "sushi",
        stop: true,
      },
      {
        text: "I stopped you. Need a short one. Now summarize that story shortly in 1 sentence",
        model: "sushi",
      },
    ],
  })
})

test("Chat", async ({ page }) => {
  test.slow()

  await page.goto(getURL({ isMember, isLive }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await chat({
    isNewChat: false,
    page,
    isMember,
    isLive,
    agentMessageTimeout: 120000,
    instruction: "Help me plan a 3-day trip to Tokyo",
    prompts: [
      {
        text: "List shortly the top 3 must-see attractions in Tokyo",
        model: "sushi",
      },
      {
        text: "Suggest briefly a simple itinerary for day 1",
        model: "claude",
      },
      {
        text: "Shortly explain the best way to get around",
        model: "chatGPT",
      },
      {
        text: "How can I enable character profile? Answer shortly",
        model: "perplexity",
      },
      {
        text: "Create a futuristic cityscape at sunset with flying cars, 4K, hyperrealistic",
        imageGenerationEnabled: true,

        model: "sushi",
      },
    ],
  })
})

test("Thread", async ({ page }) => {
  test.slow()
  await thread({ page, isLive })
})

// test("Collaboration", async ({ page, browser }) => {
//   await collaboration({
//     page,
//     browser,
//     isMember,
//     isLive,
//     collaborate: isLive ? VEX_TEST_EMAIL_4 : undefined,
//   })
// })

test.skip("File upload", async ({ page }) => {
  // test.slow()
  await page.goto(getURL({ isMember, isLive }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  const result = await chat({
    artifacts: {
      paste: 2,
      pdf: 1,
    },
    isNewChat: false,
    page,
    isLive,
    isMember,
    instruction: "Lets upload some files",
    prompts: [
      {
        text: "Hey Vex, Analyze this paste(s) and image and video shortly",
        model: "sushi",
        mix: {
          paste: 1,
          image: 1,
          video: 1,
        },
        like: false,
      },
      {
        text: "Hey Vex, Analyze these files briefly",
        model: "sushi",
        mix: {
          paste: 1,
          pdf: 1,
          image: 1,
        },
        like: false,
      },
    ],
  })
})

test.only("Create App", async ({ page }) => {
  await createApp({ page, isLive, app: "test", slug: "test", isMember })
})

test.skip("App Name Validation - Minimum 3 Characters", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await wait(5000)

  // Click add agent button
  const addAgentButton = page.getByTestId("add-agent-button")
  await addAgentButton.click()

  // Clear name input
  const nameInput = page.getByTestId("name-input")
  await nameInput.clear()

  // Error message should appear
  const errorMessage = page.getByTestId("name-error-message")
  await errorMessage.waitFor({ state: "visible" })

  // System Prompt button should not be visible
  const systemPromptButton = page.getByTestId("system-prompt-button")
  await systemPromptButton.waitFor({ state: "hidden" })
})

test.skip("App Name Validation - 3 Characters Passes", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await wait(5000)

  const addAgentButton = page.getByTestId("add-agent-button")
  await addAgentButton.click()

  const nameInput = page.getByTestId("name-input")
  await nameInput.clear()
  await nameInput.fill("ABC") // Exactly 3 characters

  // Error should not be visible
  const errorMessage = page.getByTestId("name-error-message")
  await errorMessage.waitFor({ state: "hidden" })

  // System Prompt button should be visible
  const systemPromptButton = page.getByTestId("system-prompt-button")
  await systemPromptButton.waitFor({ state: "visible" })
})

test.skip("System Prompt Validation - Required Field", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await wait(5000)

  const addAgentButton = page.getByTestId("add-agent-button")
  await addAgentButton.click()

  const nameInput = page.getByTestId("name-input")
  await nameInput.fill("TestApp")

  // Click System Prompt button
  const systemPromptButton = page.getByTestId("system-prompt-button")
  await systemPromptButton.click()

  // System prompt textarea should be visible
  const systemPromptTextarea = page.getByTestId("system-prompt-textarea")
  await systemPromptTextarea.waitFor({ state: "visible" })

  // Continue button should be visible
  const continueButton = page.getByTestId("continue-button")
  await continueButton.waitFor({ state: "visible" })

  // Click continue without filling system prompt
  await continueButton.click()

  await wait(1000)

  // Modal should still be open (validation failed)
  await systemPromptTextarea.waitFor({ state: "visible" })
})
