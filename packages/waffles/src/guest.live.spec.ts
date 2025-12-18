import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { clean } from "./shared/clean"
import { getURL, VEX_LIVE_FINGERPRINT } from "."
import { subscribe } from "./shared/subscribe"

const isMember = false

test.beforeEach(async ({ page }) => {
  await clean({ page, fingerprint: VEX_LIVE_FINGERPRINT })
})

test("Subscribe As Guest", async ({ page }) => {
  await page.goto(
    getURL({
      isMember,
      fingerprint: VEX_LIVE_FINGERPRINT,
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

test("Chat", async ({ page }) => {
  test.slow()

  await page.goto(getURL({ isMember, fingerprint: VEX_LIVE_FINGERPRINT }), {
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
        model: "perplexity",
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

test("File upload", async ({ page }) => {
  // test.slow()
  await page.goto(getURL({ isMember, fingerprint: VEX_LIVE_FINGERPRINT }), {
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
