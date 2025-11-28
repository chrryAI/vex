import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { subscribe } from "./shared/subscribe"
import { getURL, TEST_MEMBER_FINGERPRINTS } from "."
import { thread } from "./shared/thread"
import { collaboration } from "./shared/collaboration"
import { limit } from "./shared/limit"
const isMember = false
import { v4 as uuidv4 } from "uuid"

test.beforeEach(async ({ page }) => {
  // await page.goto(TEST_URL, { waitUntil: "networkidle" })
  // const cookieConsentContent = page.getByTestId("cookie-consent-content")
  // await expect(cookieConsentContent).toBeVisible()
  // const acceptAllButton = page.getByTestId("accept-all-button")
  // await expect(acceptAllButton).toBeVisible()
  // await acceptAllButton.click()
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
    email: process.env.VEX_TEST_EMAIL_3!,
    password: process.env.VEX_TEST_PASSWORD_3!,
    gift: process.env.VEX_TEST_EMAIL_3!,
  })
})

test("File upload", async ({ page }) => {
  // test.slow()
  await page.goto(getURL({ isLive: false, isMember }), {
    waitUntil: "networkidle",
  })

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
        text: "Hey Vex, Analyze this files",
        model: "sushi",
        mix: {
          paste: 1,
          pdf: 2,
        },
        like: true,
      },
      {
        text: "Hey Vex, Analyze this pdf(s) and images",
        model: "sushi",
        mix: {
          pdf: 4,
          image: 2,
        },
        like: true,
      },

      {
        text: "Hey Vex, Analyze this paste(s) and video",
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

test.only("Thread", async ({ page }) => {
  test.slow()
  await thread({ page, bookmark: true })
})

test("Long text", async ({ page }) => {
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

// test("File upload", async ({ page }) => {
//   await chat({
//     page,
//     isMember,
//     instruction: "Long text",
//     // agentMessageTimeout: 12000,
//     prompts: [
//       {
//         text: "Analyze this video data",
//         model: "sushi",
//       },
//       {
//         text: "long",
//         model: "sushi",
//         stop: true,
//       },
//       {
//         text: "Should delete this message",
//         model: "sushi",
//         delete: true,
//       },
//     ],
//   })
// })

test("Collaboration", async ({ page, browser }) => {
  await collaboration({ page, browser, isMember })
})
