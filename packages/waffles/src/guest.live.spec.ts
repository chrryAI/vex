import { test } from "@playwright/test"
import { chat } from "./shared/chat"

const isMember = false
const isLiveTest = false

test.skip("Chat", async ({ page }) => {
  test.slow()
  await chat({
    isLiveTest,
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
        model: "claude",
        like: true,
      },
      {
        text: "What's the best way to get around between these places?",
        model: "chatGPT",
        like: true,
      },
    ],
  })

  // await chat({
  //   isNewChat: true,
  //   isLiveTest,
  //   page,
  //   creditsConsumed: 2 + 3 + 4,
  //   messagesConsumed: 3,
  //   agentMessageTimeout: 120000,
  //   isMember,
  //   instruction: "Generate creative images for my travel blog",
  //   prompts: [
  //     {
  //       text: "Create a futuristic cityscape at sunset with flying cars, 4K, hyperrealistic",
  //       imageGenerationEnabled: true,
  //       like: true,
  //     },
  //   ],
  // })
})
