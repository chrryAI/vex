import { test } from "@playwright/test"
import { chat } from "./shared/chat"

const isMember = false

test.skip("Chat", async ({ page }) => {
  test.slow()
  await chat({
    isLiveTest: true,
    isNewChat: true,
    page,
    isMember,
    agentMessageTimeout: 120000,
    instruction: "Help me plan a 3-day trip to Tokyo",
    prompts: [
      {
        text: "What are the must-see attractions in Tokyo?",
        model: "sushi",
      },
      {
        text: "Can you suggest a detailed itinerary for day 1?",
        model: "sushi",
        like: true,
      },
      {
        text: "What's the best way to get around between these places?",
        model: "sushi",
        like: true,
      },
      {
        text: "Should not select this agent should continue with deepSeek",
        model: "claude",
      },
    ],
  })

  await chat({
    isNewChat: true,
    isLiveTest: true,
    page,
    agentMessageTimeout: 120000,
    isMember,
    instruction: "Generate creative images for my travel blog",
    prompts: [
      {
        text: "Create a futuristic cityscape at sunset with flying cars, 4K, hyperrealistic",
        imageGenerationEnabled: true,
        like: true,
      },
    ],
  })
})
