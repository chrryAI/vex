import { getAiAgents, createAiAgent } from "@repo/db"
import { NextResponse, NextRequest } from "next/server"
import { createCustomAiAgentSchema } from "chrry/schemas/agentSchema"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"

export async function GET(request: NextRequest) {
  const url = request.url
  const urlParams = new URL(url)
  const appId = urlParams.searchParams.get("appId")

  // const member = await getMember()
  // const guest = await getGuest()

  // BACKWARD COMPATIBLE FIX AFTER RELEASE ALL PLATFORMS
  // if (!member && !guest) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // }

  const aiAgents = await getAiAgents({
    appId: appId || undefined,
  })
  return NextResponse.json(aiAgents)
}

export async function POST(req: Request) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    if (!member && !guest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Validate with Zod
    const validation = createCustomAiAgentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation?.error?.issues[0]?.message },
        { status: 400 },
      )
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

    return NextResponse.json(customAgent)
  } catch (error) {
    console.error("Error creating custom AI agent:", error)
    return NextResponse.json(
      { error: "Failed to create custom model" },
      { status: 500 },
    )
  }
}
