import { Hono } from "hono"
import { getAiAgents, createAiAgent } from "@repo/db"
import { createCustomAiAgentSchema } from "chrry/schemas/agentSchema"
import { getMember, getGuest } from "../lib/auth"

const app = new Hono()

app.get("/", async (c) => {
  const appId = c.req.query("appId")

  const member = await getMember(c)
  const guest = await getGuest(c)

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const aiAgents = await getAiAgents({
    include: appId || undefined,
  })
  return c.json(aiAgents)
})

app.post("/", async (c) => {
  try {
    const member = await getMember(c)
    const guest = await getGuest(c)

    if (!member && !guest) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const body = await c.req.json()

    // Validate with Zod
    const validation = createCustomAiAgentSchema.safeParse(body)

    if (!validation.success) {
      return c.json({ error: validation?.error?.issues[0]?.message }, 400)
    }

    const { name, apiKey, displayName, modelId, apiURL, capabilities } =
      validation.data

    // Create the custom AI agent
    // Store in format: "baseURL|apiKey" to allow separation later
    const storedApiURL = apiURL
      ? `${apiURL}|${apiKey}`
      : `https://api.openai.com/v1|${apiKey}`

    const customAgent = await createAiAgent({
      name: name.toLowerCase().replace(/\s+/g, "-"),
      displayName: displayName || name,
      version: "1.0.0",
      apiURL: storedApiURL,
      modelId: modelId || "custom",
      userId: member?.id || guest?.id,
      guestId: guest?.id,
      state: "active",
      creditCost: 1,
      capabilities: {
        text: capabilities?.text ?? true,
        image: capabilities?.image ?? false,
        audio: capabilities?.audio ?? false,
        video: capabilities?.video ?? false,
        webSearch: capabilities?.webSearch ?? false,
        imageGeneration: capabilities?.imageGeneration ?? false,
        codeExecution: capabilities?.codeExecution ?? false,
        pdf: capabilities?.pdf ?? false,
      },
      authorization: "user",
      appId: undefined, // Custom agents are app-specific if needed
    })

    return c.json(customAgent)
  } catch (error) {
    console.error("Error creating custom AI agent:", error)
    return c.json({ error: "Failed to create custom model" }, 500)
  }
})

export { app as aiAgents }
