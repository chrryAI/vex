import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { clean } from "./shared/clean"
import { limit } from "./shared/limit"

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
import createApp from "./shared/createApp"

const isMember = false

const isLive = true

test("Subscribe As Guest", async ({ page }) => {
  await clean({ page, isLive })
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
  await clean({ page, isLive })
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
  await clean({ page, isLive })
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
  await clean({ page, isLive })
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
  await clean({ page, isLive })
  test.slow()

  await page.goto(getURL({ isMember, isLive }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await chat({
    artifacts: {
      paste: 1,
      pdf: 1,
      image: 1,
      video: 1,
    },
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
  await clean({ page, isLive })
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
  await clean({ page, isLive })
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

test.skip("Create A Claude App", async ({ page }) => {
  await clean({ page, isLive })
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await wait(5000)
  await createApp({
    page,
    isLive,
    app: "test",
    slug: "vex",
    isMember,
    defaultAgent: "claude",
    theme: "dark",
    colorScheme: "orange",
    placeholder: "Claude placeholder",
    temperature: 0.9,

    isNewChat: true,
  })
})

test("Create A Sushi App", async ({ page }) => {
  await clean({ page, isLive: false })
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await wait(5000)
  await createApp({
    page,
    isLive,
    app: "test",
    slug: "vex",
    isMember,
    defaultAgent: "sushi",
    theme: "light",
    colorScheme: "red",
    placeholder: "Sushi placeholder",
    temperature: 0.3,
    nav: [
      {
        name: "test", // Feedback & Insights
        chat: {
          prompts: [
            { model: "sushi", text: "What feedback patterns are emerging?" },
            {
              model: "sushi",
              text: "Which features are users requesting most?",
            },
            {
              model: "sushi",
              text: "Show me sentiment analysis from recent feedback",
            },
          ],
        },
      },
    ],
  })
})

test("Chat - Hourly Limit Test", async ({ page }) => {
  await clean({ page, isLive: false })
  test.slow()
  await limit({ page })
})
