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
import { signIn } from "./shared/signIn"

const isMember = true

const isLive = true
test.beforeEach(async ({ page }) => {
  await clean({ page, isLive, isMember })
})

test.skip("Subscribe As Member", async ({ page }) => {
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

test.only("App", async ({ page }) => {
  await page.goto(getURL({ isLive, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await signIn({ page })
  await app({
    page,
    isMember,
    isLive,
    slug: "vex",
    nav: [
      {
        name: "peach",
        chat: {
          prompts: [
            { model: "sushi", text: "What feedback do you have?" },
            { model: "sushi", text: "Show me recent insights" },
            { model: "sushi", text: "How can I improve my apps?" },
          ],
        },
      },
      {
        name: "bloom",
        chat: {
          prompts: [
            { model: "sushi", text: "What can you help me with?" },
            { model: "sushi", text: "Show me focus features" },
            { model: "sushi", text: "How do I track my tasks?" },
          ],
        },
      },
      {
        name: "vault",
        chat: {
          prompts: [
            { model: "sushi", text: "Show my expenses" },
            { model: "sushi", text: "What's my budget status?" },
            { model: "sushi", text: "Track a new expense" },
          ],
        },
      },
      {
        name: "atlas",
        chat: {
          prompts: [
            { model: "sushi", text: "Find places in Amsterdam" },
            { model: "sushi", text: "Show me travel routes" },
            { model: "sushi", text: "What's nearby?" },
          ],
        },
      },
      {
        name: "chrry",
        chat: {
          prompts: [
            { model: "sushi", text: "Show me apps in the store" },
            { model: "sushi", text: "What's trending?" },
            { model: "sushi", text: "How do I create an app?" },
          ],
        },
      },
    ],
    isNewChat: true,
  })
})

test.skip("Invite", async ({ page }) => {
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

test.skip("Gift", async ({ page }) => {
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

test.skip("Long text", async ({ page }) => {
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

test.skip("Chat", async ({ page }) => {
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
        text: "Which model are you using? Answer briefly",
        model: "gemini",
      },
      {
        text: "How can I enable character profile? Answer shortly",
        model: "sushi",
      },
      {
        text: "Create a futuristic cityscape at sunset with flying cars, 4K, hyperrealistic",
        imageGenerationEnabled: true,

        model: "sushi",
      },
    ],
  })
})

test.skip("Thread", async ({ page }) => {
  test.slow()
  await thread({ page, isLive })
})

// test.skip("Collaboration", async ({ page, browser }) => {
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
        text: "Hey Vex, Analyze this paste(s) and video shortly",
        model: "sushi",
        mix: {
          paste: 1,
          pdf: 1,
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
      {
        text: "Hey Vex, Analyze this pdf(s) and images shortly",
        model: "sushi",
        mix: {
          pdf: 1,
          image: 2,
        },
        like: false,
      },
    ],
  })
})
