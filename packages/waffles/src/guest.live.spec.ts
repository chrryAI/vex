import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { clean } from "./shared/clean"
import { getURL, wait, VEX_TEST_EMAIL_3, VEX_TEST_PASSWORD_3 } from "."
import { subscribe } from "./shared/subscribe"
import { collaboration } from "./shared/collaboration"
import { thread } from "./shared/thread"
import { v4 as uuidv4 } from "uuid"

const isMember = false

const isLive = true
test.beforeEach(async ({ page }) => {
  await clean({ page, isLive })
})

test.only("Invite", async ({ page }) => {
  await page.goto(
    getURL({
      isLive,
      isMember,
    }),
    {
      waitUntil: "networkidle",
    },
  )
  await subscribe({
    page,
    isMember,
    invite: `${uuidv4()}@gmail.com`,
  })
})

test.only("Gift", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
  })
  await page.goto(
    getURL({
      isLive,
      isMember,
    }),
    {
      waitUntil: "networkidle",
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

test.only("Subscribe As Guest", async ({ page }) => {
  await page.goto(
    getURL({
      isMember,
      isLive,
    }),
    {
      waitUntil: "networkidle",
    },
  )
  await wait(2000)

  await subscribe({
    page,
    isMember,
  })
})

test.only("Long text", async ({ page }) => {
  const result = await chat({
    page,
    isMember,
    isLiveTest: isLive,
    instruction: "Long text",
    // agentMessageTimeout: 12000,
    prompts: [
      {
        text: "Give me long text",
        model: "sushi",
        stop: true,
      },
      {
        text: "Give me short text",
        model: "sushi",
      },
    ],
  })
})

test.only("Gift", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
  })
  await page.goto(
    getURL({
      isLive,
      isMember,
    }),
    {
      waitUntil: "networkidle",
    },
  )
  await subscribe({
    page,
    isMember,
    email: process.env.VEX_TEST_EMAIL_3!,
    password: process.env.VEX_TEST_PASSWORD_3!,
    gift: process.env.VEX_TEST_EMAIL_3!,
  })
})

test.only("Chat", async ({ page }) => {
  test.slow()

  await page.goto(getURL({ isMember, isLive }), {
    waitUntil: "networkidle",
  })

  await chat({
    isNewChat: false,
    page,
    isMember,
    agentMessageTimeout: 120000,
    instruction: "Help me plan a 3-day trip to Tokyo",
    prompts: [
      {
        text: "What are the must-see attractions in Tokyo?",
        model: "sushi",
        like: true,
      },
      {
        text: "Can you suggest a detailed itinerary for day 1?",
        model: "claude",
        like: true,
      },
      {
        text: "What's the best way to get around between these places?",
        model: "chatGPT",
        like: true,
      },
      {
        text: "Which model are stored in app are you using?",
        model: "gemini",
        like: true,
      },
      {
        text: "How can I enable character profile?",
        model: "sushi",
        like: true,
      },
      {
        text: "Create a futuristic cityscape at sunset with flying cars, 4K, hyperrealistic",
        imageGenerationEnabled: true,
        like: true,
        model: "sushi",
      },
    ],
  })
})

test.only("Collaboration", async ({ page, browser }) => {
  await collaboration({ page, browser, isMember, isLive })
})

test.only("File upload", async ({ page }) => {
  // test.slow()
  await page.goto(getURL({ isMember, isLive }), {
    waitUntil: "networkidle",
  })

  const result = await chat({
    artifacts: {
      paste: 2,
      pdf: 1,
    },
    isNewChat: false,
    page,
    isMember,
    instruction: "Lets upload some files",
    prompts: [
      {
        text: "Hey Vex, Analyze this files",
        model: "sushi",
        mix: {
          paste: 1,
          pdf: 1,
          image: 1,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this pdf(s) and images",
        model: "sushi",
        mix: {
          pdf: 1,
          image: 2,
        },
        like: true,
      },

      {
        text: "Hey Vex, Analyze this paste(s) and video",
        model: "sushi",
        mix: {
          paste: 1,
          pdf: 1,
          video: 1,
        },
        like: true,
      },
    ],
  })
})

test.only("Thread", async ({ page }) => {
  test.slow()
  await thread({ page, bookmark: true, messagesConsumed: 2 })
})
