import { test } from "@playwright/test"
import { v4 as uuidv4 } from "uuid"
import {
  getURL,
  VEX_TEST_EMAIL_3,
  VEX_TEST_FINGERPRINT_3,
  VEX_TEST_PASSWORD_3,
} from "."
import { app } from "./shared/app"
import { chat } from "./shared/chat"
import { clean } from "./shared/clean"
import { collaboration } from "./shared/collaboration"
import { limit } from "./shared/limit"
import { signIn } from "./shared/signIn"
import { subscribe } from "./shared/subscribe"
import { thread } from "./shared/thread"

const isMember = true

test.beforeEach(async ({ page }) => {
  await clean({ page })
})

// test("Sync Plausible", async ({ page }) => {
//   await page.goto("https://a.chrry.dev", {
//     waitUntil: "networkidle",
//     timeout: 100000,
//   })

//   const items = document.querySelectorAll(".relative")

//   items.forEach((item) => {
//     item.click()

//     const input = document.querySelector("focus:border-blue-300")
//     input?.click()

//   const button = document.querySelector("button")
//   button?.click()
//   })
// })

test("Subscribe", async ({ page }) => {
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await signIn({ page })
  await subscribe({ page, isMember })
})

test("Invite", async ({ page }) => {
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await signIn({ page })
  await page.goto(
    getURL({
      isLive: false,
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
  })
})

test("Gift", async ({ page }) => {
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await signIn({ page })
  await page.goto(
    getURL({
      isLive: false,
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
    email: process.env.VEX_TEST_EMAIL_4!,
    password: process.env.VEX_TEST_PASSWORD_4!,
    gift: process.env.VEX_TEST_EMAIL_4!,
  })
})

test("Chat - Hourly Limit Test", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await signIn({ page })
  await limit({ page, isMember })
})

test("Thread", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await signIn({ page })
  await thread({ page, bookmark: true, isMember })
})

test("Collaboration", async ({ page, browser }) => {
  await page.goto(
    getURL({
      isLive: false,
      isMember,
      fingerprint: VEX_TEST_FINGERPRINT_3,
    }),
    {
      waitUntil: "networkidle",
      timeout: 100000,
    },
  )

  await signIn({
    page,
    email: VEX_TEST_EMAIL_3,
    password: VEX_TEST_PASSWORD_3,
  })

  await collaboration({
    page,
    browser,
    isMember,
    fingerprint: VEX_TEST_FINGERPRINT_3,
  })
})

test("Debate", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })
  await signIn({ page })

  await chat({
    isNewChat: false,
    page,
    isMember,
    prompts: [
      {
        text: "Should AI be regulated? Debate shortly the balance between innovation and safety",
        model: "claude",
        debateAgent: "sushi",
      },
      {
        text: "Is Mars colonization ethical? Briefly debate resource allocation",
        model: "chatGPT",
        debateAgent: "perplexity",
      },
      {
        text: "Universal Basic Income: Debate shortly pros and cons",
        model: "sushi",
        debateAgent: "claude",
      },
      {
        text: "Human vs animal lives in medical research? Debate briefly",
        model: "sushi",
        debateAgent: "chatGPT",
      },
      {
        text: "Quantum computing and cybersecurity? Debate shortly both sides",
        model: "sushi",
        debateAgent: "gemini",
      },
    ],
  })
})

test.only("App", async ({ page }) => {
  await clean({ page, isMember })

  await page.goto(getURL({ isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  await signIn({ page })
  await app({
    page,
    isMember,
    slug: "vex",
    nav: [
      {
        name: "vault", // Finance & Budgeting
        chat: {
          prompts: [
            { model: "sushi", text: "Where am I overspending this month?" },
            { model: "sushi", text: "Compare my spending to last month" },
            { model: "sushi", text: "What's my biggest expense category?" },
          ],
        },
      },
      {
        name: "peach", // Feedback & Insights
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
      {
        name: "bloom", // Productivity & Focus
        chat: {
          prompts: [
            { model: "sushi", text: "What's my most productive time of day?" },
            { model: "sushi", text: "Show my focus session statistics" },
            { model: "sushi", text: "Help me plan a deep work session" },
          ],
        },
      },

      {
        name: "atlas", // Travel & Navigation
        chat: {
          prompts: [
            { model: "sushi", text: "Plan a day trip in Amsterdam" },
            { model: "sushi", text: "Find the best coffee shops nearby" },
            { model: "sushi", text: "What's the fastest route to Centraal?" },
          ],
        },
      },
      {
        name: "chrry", // App Marketplace
        chat: {
          prompts: [
            { model: "sushi", text: "What are the top-rated apps this week?" },
            { model: "sushi", text: "Show me apps for productivity" },
            { model: "sushi", text: "How do I monetize my app idea?" },
          ],
        },
      },
    ],
    isNewChat: true,
  })
})
