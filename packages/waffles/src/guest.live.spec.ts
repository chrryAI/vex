import { test } from "@playwright/test"
import { chat } from "./shared/chat"
import { clean } from "./shared/clean"
import {
  getURL,
  VEX_TEST_EMAIL,
  VEX_TEST_EMAIL_2,
  VEX_TEST_FINGERPRINT_2,
  VEX_TEST_PASSWORD,
  VEX_LIVE_FINGERPRINT,
} from "."
import { signIn } from "./shared/signIn"

const isMember = false
const isLive = false

test.beforeEach(async ({ page }) => {
  await clean({ page, fingerprint: VEX_LIVE_FINGERPRINT })
})

test.only("Chat", async ({ page }) => {
  test.slow()

  await page.goto(
    getURL({ isLive, isMember, fingerprint: VEX_LIVE_FINGERPRINT }),
    {
      waitUntil: "networkidle",
    },
  )

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
