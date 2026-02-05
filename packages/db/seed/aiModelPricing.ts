import { db } from "../index"
import { aiModelPricing } from "../src/schema"

export async function seedAIModelPricing() {
  console.log("🤖 Seeding AI model pricing...")

  const pricingData = [
    // OpenAI Models
    {
      provider: "openai" as const,
      modelName: "gpt-4o",
      inputCostPerKToken: 25, // 2.5 credits per 1K input tokens
      outputCostPerKToken: 100, // 10 credits per 1K output tokens
      isActive: true,
      description: "GPT-4 Optimized - Best for complex reasoning",
    },
    {
      provider: "openai" as const,
      modelName: "gpt-4o-mini",
      inputCostPerKToken: 2, // 0.2 credits per 1K input tokens
      outputCostPerKToken: 6, // 0.6 credits per 1K output tokens
      isActive: true,
      description: "GPT-4 Mini - Fast and affordable",
    },
    {
      provider: "openai" as const,
      modelName: "gpt-3.5-turbo",
      inputCostPerKToken: 5, // 0.5 credits per 1K input tokens
      outputCostPerKToken: 15, // 1.5 credits per 1K output tokens
      isActive: true,
      description: "GPT-3.5 Turbo - Balanced performance",
    },

    // Claude Models
    {
      provider: "claude" as const,
      modelName: "claude-3-5-sonnet-20241022",
      inputCostPerKToken: 30, // 3 credits per 1K input tokens
      outputCostPerKToken: 150, // 15 credits per 1K output tokens
      isActive: true,
      description: "Claude 3.5 Sonnet - Best for creative writing",
    },
    {
      provider: "claude" as const,
      modelName: "claude-3-5-haiku-20241022",
      inputCostPerKToken: 10, // 1 credit per 1K input tokens
      outputCostPerKToken: 50, // 5 credits per 1K output tokens
      isActive: true,
      description: "Claude 3.5 Haiku - Fast and efficient",
    },
    {
      provider: "claude" as const,
      modelName: "claude-3-opus-20240229",
      inputCostPerKToken: 150, // 15 credits per 1K input tokens
      outputCostPerKToken: 750, // 75 credits per 1K output tokens
      isActive: true,
      description: "Claude 3 Opus - Most powerful, highest quality",
    },

    // DeepSeek Models
    {
      provider: "deepseek" as const,
      modelName: "deepseek-chat",
      inputCostPerKToken: 1, // 0.1 credits per 1K input tokens
      outputCostPerKToken: 2, // 0.2 credits per 1K output tokens
      isActive: true,
      description: "DeepSeek Chat - Ultra affordable",
    },
    {
      provider: "deepseek" as const,
      modelName: "deepseek-reasoner",
      inputCostPerKToken: 5, // 0.5 credits per 1K input tokens
      outputCostPerKToken: 20, // 2 credits per 1K output tokens
      isActive: true,
      description: "DeepSeek Reasoner - Advanced reasoning at low cost",
    },

    // Sushi (Porffor) - Free/Local
    {
      provider: "sushi" as const,
      modelName: "sushi-local",
      inputCostPerKToken: 0, // Free - runs locally
      outputCostPerKToken: 0,
      isActive: true,
      description: "Sushi Local - Free WebAssembly execution",
    },
  ]

  for (const pricing of pricingData) {
    await db
      .insert(aiModelPricing)
      .values(pricing)
      .onConflictDoNothing()
      .catch((err) => {
        console.error(`Failed to seed ${pricing.modelName}:`, err)
      })
  }

  console.log("✅ AI model pricing seeded successfully!")
}
