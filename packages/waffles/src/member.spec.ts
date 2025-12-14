import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { subscribe } from "./shared/subscribe"
import {
  getURL,
  VEX_TEST_EMAIL_3,
  VEX_TEST_FINGERPRINT_3,
  VEX_TEST_PASSWORD_3,
} from "."
import { limit } from "./shared/limit"
import { signIn } from "./shared/signIn"
import { thread } from "./shared/thread"
import { v4 as uuidv4 } from "uuid"
import { collaboration } from "./shared/collaboration"
import { clean } from "./shared/clean"
const isMember = true

test.beforeEach(async ({ page }) => {
  await clean({ page })
})

test("Subscribe", async ({ page }) => {
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })

  await signIn({ page })
  await subscribe({ page, isMember })
})

test("Invite", async ({ page }) => {
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })
  await signIn({ page })
  await page.goto(
    getURL({
      isLive: false,
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

test("Gift", async ({ page }) => {
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })
  await signIn({ page })
  await page.goto(
    getURL({
      isLive: false,
      isMember,
    }),
    {
      waitUntil: "networkidle",
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

test("Debate", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })
  await signIn({ page })

  await chat({
    isNewChat: false,
    page,
    isMember,
    prompts: [
      {
        text: "Should advanced AI development be regulated by governments? Debate the balance between innovation and safety",
        model: "claude",
        debateAgent: "sushi",
      },
      {
        text: "Is Mars colonization an ethical priority when Earth still faces major problems? Consider resource allocation arguments",
        model: "chatGPT",
        debateAgent: "perplexity",
      },
      {
        text: "Universal Basic Income: Solution to automation or threat to work ethic? Debate economic and social impacts.",
        model: "sushi",
        debateAgent: "claude",
      },
      {
        text: "Is it morally justifiable to prioritize human lives over animal lives in medical research?",
        model: "sushi",
        debateAgent: "chatGPT",
      },
      {
        text: "Will quantum computing ultimately benefit or threaten cybersecurity? Debate both technological possibilities.",
        model: "sushi",
        debateAgent: "gemini",
      },
    ],
  })
})

test("Chat - Hourly Limit Test", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })

  await signIn({ page })
  await limit({ page, isMember })
})

test("Thread", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })

  await signIn({ page })
  await thread({ page, bookmark: true, isMember })
})

test("Long text", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })

  await signIn({ page })
  await chat({
    page,
    isMember,
    instruction: "Long text",
    // agentMessageTimeout: 12000,
    prompts: [
      {
        text: "Short",
        model: "sushi",
      },
      {
        text: "long",
        model: "sushi",
        stop: true,
      },
      {
        text: "Should delete this message",
        model: "sushi",
        delete: true,
      },
    ],
  })
})

test("File upload", async ({ page }) => {
  test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })

  await signIn({ page })

  await chat({
    artifacts: {
      paste: 3,
      pdf: 3,
    },
    isNewChat: false,
    page,
    isMember,
    instruction: "Lets upload some files",
    prompts: [
      {
        text: "Hey Vex, Analyze this text",
        model: "sushi",
        mix: {
          paste: 4,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this text",
        model: "gemini",
        mix: {
          image: 1,
          paste: 1,
          audio: 1,
          pdf: 1,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this pdf",
        model: "chatGPT",
        mix: {
          pdf: 4,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this video",
        model: "claude",
        mix: {
          video: 1,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this audio",
        model: "sushi",
        mix: {
          audio: 4,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this images",
        model: "claude",
        mix: {
          image: 4,
        },
        like: true,
      },
    ],
  })
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
