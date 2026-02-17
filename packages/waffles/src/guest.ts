import { test } from "@playwright/test"
import { getURL, TEST_MEMBER_FINGERPRINTS } from "."
import { chat } from "./shared/chat"
import { collaboration } from "./shared/collaboration"
import { limit } from "./shared/limit"
import { subscribe } from "./shared/subscribe"
import { thread } from "./shared/thread"

const isMember = false

import { v4 as uuidv4 } from "uuid"
import { clean } from "./shared/clean"

test.beforeEach(async ({ page }) => {
  await clean({ page })
})

test("Subscribe As Guest", async ({ page }) => {
  await page.goto(
    getURL({
      isLive: false,
      isMember,
      fingerprint: TEST_MEMBER_FINGERPRINTS[0],
    }),
    {
      waitUntil: "networkidle",
      timeout: 100000,
    },
  )
  await subscribe({
    page,
    isMember,
  })
})

test("Invite", async ({ page }) => {
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
    email: process.env.VEX_TEST_EMAIL_3!,
    password: process.env.VEX_TEST_PASSWORD_3!,
    gift: process.env.VEX_TEST_EMAIL_3!,
  })
})

test("File upload", async ({ page }) => {
  // test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
    timeout: 100000,
  })

  const _result = await chat({
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
        text: "Hey Vex, Analyze these files shortly",
        model: "sushi",
        mix: {
          paste: 1,
          pdf: 2,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this pdf(s) and images briefly",
        model: "sushi",
        mix: {
          pdf: 4,
          image: 2,
        },
        like: true,
      },

      {
        text: "Hey Vex, Analyze this paste(s) and video shortly",
        model: "sushi",
        mix: {
          paste: 4,
          video: 1,
        },
        like: true,
      },
    ],
  })
})

test("Chat - Hourly Limit Test", async ({ page }) => {
  test.slow()
  await limit({ page })
})

test("Thread", async ({ page }) => {
  test.slow()
  await thread({ page, bookmark: true })
})

test("Long text", async ({ page }) => {
  const _result = await chat({
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

test("Collaboration", async ({ page, browser }) => {
  await collaboration({ page, browser, isMember })
})
