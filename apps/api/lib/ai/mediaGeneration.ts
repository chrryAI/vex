import type { appWithStore } from "@chrryai/chrry/types"
import * as fal from "@fal-ai/serverless-client"
import {
  type app,
  decrypt,
  type guest,
  safeDecrypt,
  type user,
  type userWithRelations,
} from "@repo/db"
import Replicate from "replicate"
import { v4 as uuidv4 } from "uuid"
import { captureException } from "../captureException"
import { upload } from "../minio"

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY
const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY

/**
 * Image Generation Options
 */
export interface ImageGenerationOptions {
  prompt: string
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
  model?: string // e.g. "flux-pro", "flux-dev"
  provider?: "replicate" | "fal" | "openrouter"
  userId?: string
  messageId?: string
  apiKey?: string // Replicate API key override
  falKey?: string // Fal API key override
  openRouterKey?: string // OpenRouter API key override
  user?: user
  guest?: guest
  app?: app | appWithStore
}

/**
 * Video Generation Options
 */
export interface VideoGenerationOptions {
  prompt: string
  aspectRatio?: "16:9" | "9:16"
  duration?: number
  model?: string
  provider?: "replicate" | "fal" | "openrouter"
  userId?: string
  messageId?: string
  apiKey?: string // Replicate API key override
  falKey?: string // Fal API key override
  user?: user | userWithRelations | null
  guest?: guest | null
  app?: app | appWithStore | null
}

const plusTiers = ["plus", "pro"]

/**
 * Unified Image Generation
 */
export async function generateImage(options: ImageGenerationOptions): Promise<{
  url: string
  prompt: string
  provider: string
  member?: user | null
  guest?: guest | null
  model: string
}> {
  const isBYOK = !!options.user?.apiKeys?.openrouter
  const byokReplicateKey = options.user?.apiKeys?.replicate
    ? await decrypt(options.user?.apiKeys?.replicate)
    : undefined

  const byokReplicateAppKey = byokReplicateKey
    ? undefined
    : options.app?.apiKeys?.replicate
      ? safeDecrypt(options.app?.apiKeys?.replicate)
      : !plusTiers.includes(options.app?.tier || "")
        ? process.env.REPLICATE_API_KEY
        : ""

  const byokFalKey = options.user?.apiKeys?.fal
    ? await decrypt(options.user?.apiKeys?.fal)
    : undefined

  const byokFalAppKey = byokFalKey
    ? undefined
    : options.app?.apiKeys?.fal
      ? safeDecrypt(options.app?.apiKeys?.fal)
      : !plusTiers.includes(options.app?.tier || "")
        ? process.env.FAL_KEY
        : ""

  const {
    prompt,
    aspectRatio = "1:1",
    messageId = uuidv4(),
    apiKey = isBYOK
      ? byokReplicateKey || byokReplicateAppKey
      : byokReplicateAppKey,
    falKey = isBYOK ? byokFalKey || byokFalAppKey : byokFalAppKey,
    //Problematic techno 📀
  } = options

  // Initial provider selection: try OpenRouter for flux models if requested or byok
  const providerToTry: "fal" | "replicate" =
    options.provider ?? ((!apiKey && falKey) ? "fal" : "replicate")

  const model = options.model || "flux-pro"

  console.log(
    `🎨 Generating image via ${providerToTry} (${model}): "${prompt.substring(0, 50)}..."`,
  )

  const tryFal = async (): Promise<any> => {
    if (!falKey) throw new Error("Fal.ai API key is missing")
    const falModel =
      model === "flux-pro" ? "fal-ai/flux-pro/v1.1" : "fal-ai/flux/dev"

    const result: any = await fal.subscribe(falModel, {
      input: {
        prompt,
        image_size:
          aspectRatio === "1:1"
            ? "square"
            : aspectRatio === "16:9"
              ? "landscape_16_9"
              : aspectRatio === "9:16"
                ? "portrait_9_16"
                : aspectRatio === "4:3"
                  ? "landscape_4_3"
                  : aspectRatio === "3:4"
                    ? "portrait_3_4"
                    : "square",
      },
      logs: true,
    })

    const imageUrl = result.images?.[0]?.url
    if (!imageUrl) throw new Error("Fal.ai generated no image URL")

    const uploaded = await upload({
      url: imageUrl,
      messageId,
      options: { type: "image", title: prompt.substring(0, 50) },
    })

    return {
      url: uploaded.url,
      prompt,
      provider: "fal",
      model: falModel,
    }
  }

  const tryReplicate = async (): Promise<any> => {
    if (!apiKey) throw new Error("Replicate API key is missing")
    const replicate = new Replicate({ auth: apiKey })

    const replicateModel = "black-forest-labs/flux-1.1-pro"
    const output = await replicate.run(replicateModel as any, {
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "png",
      },
    })

    let imageUrl: string | undefined
    if (Array.isArray(output)) imageUrl = output[0]
    else if (typeof output === "string") imageUrl = output
    else if (output && typeof (output as any).url === "function") {
      imageUrl = (await (output as any).url()).href
    }

    if (!imageUrl) throw new Error("Replicate generated no image URL")

    const uploaded = await upload({
      url: imageUrl,
      messageId,
      options: { type: "image", title: prompt.substring(0, 50) },
    })

    return {
      url: uploaded.url,
      prompt,
      provider: "replicate",
      model: replicateModel,
    }
  }

  try {
    if (providerToTry === "fal") {
      return await tryFal()
    } else {
      return await tryReplicate()
    }
  } catch (error: any) {
    if (providerToTry === "fal" && apiKey) {
      console.warn("⚠️ Fal.ai failed, falling back to Replicate...", error)
      try {
        return await tryReplicate()
      } catch (replicateError) {
        console.error("❌ Both Fal.ai and Replicate failed:", replicateError)
        throw replicateError
      }
    }
    console.error(`❌ Image generation failed (${providerToTry}):`, error)
    captureException(error)
    throw error
  }
}

/**
 * Unified Video Generation
 */
export async function generateVideo(options: VideoGenerationOptions): Promise<{
  url: string
  prompt: string
  provider: string
  model: string
}> {
  const isBYOK = !!options.user?.apiKeys?.openrouter
  const byokReplicateKey = options.user?.apiKeys?.replicate
    ? await decrypt(options.user?.apiKeys?.replicate)
    : undefined

  const byokReplicateAppKey = byokReplicateKey
    ? undefined
    : options.app?.apiKeys?.replicate
      ? safeDecrypt(options.app?.apiKeys?.replicate)
      : !plusTiers.includes(options.app?.tier || "")
        ? process.env.REPLICATE_API_KEY
        : ""

  const byokFalKey = options.user?.apiKeys?.fal
    ? await decrypt(options.user?.apiKeys?.fal)
    : undefined

  const byokFalAppKey = byokFalKey
    ? undefined
    : options.app?.apiKeys?.fal
      ? safeDecrypt(options.app?.apiKeys?.fal)
      : !plusTiers.includes(options.app?.tier || "")
        ? process.env.FAL_KEY
        : ""

  const {
    prompt,
    aspectRatio = "16:9",
    messageId = uuidv4(),
    apiKey = isBYOK ? byokReplicateKey || byokReplicateAppKey : undefined,
    falKey = isBYOK ? byokFalKey || byokFalAppKey : FAL_KEY,
  } = options

  // Initial provider selection: try Fal if we have a key, otherwise Replicate
  const providerToTry: "fal" | "replicate" =
    options.provider ?? (falKey ? "fal" : "replicate")
  const model = options.model || "kling-v1.5"

  console.log(
    `🎬 Generating video via ${providerToTry} (${model}): "${prompt.substring(0, 50)}..."`,
  )

  const tryFal = async (): Promise<any> => {
    if (!falKey) throw new Error("Fal.ai API key is missing")

    const falModel =
      model === "luma-ray"
        ? "fal-ai/luma-dream-machine/ray-2"
        : "fal-ai/kling-video/v1/standard/text-to-video"

    if (typeof (fal as any).config === "function") {
      ;(fal as any).config({ credentials: falKey })
    }

    const input = {
      prompt,
      aspect_ratio: aspectRatio,
    }

    console.log(`🎬 Fal.ai Video Generation (${falModel}):`, input)

    const result: any = await fal.subscribe(falModel, {
      input,
      logs: true,
    })

    const videoUrl = result.video?.url || result.images?.[0]?.url || result.url
    if (!videoUrl) throw new Error("Fal.ai generated no video URL")

    const uploaded = await upload({
      url: videoUrl,
      messageId,
      options: { type: "video", title: prompt.substring(0, 50) },
    })

    return {
      url: uploaded.url,
      prompt,
      provider: "fal",
      model: falModel,
    }
  }

  const tryReplicate = async (): Promise<any> => {
    if (!apiKey) throw new Error("Replicate API key is missing")
    const replicate = new Replicate({ auth: apiKey })

    const replicateModel = "luma/ray-2-540p"
    const prediction = await replicate.predictions.create({
      model: replicateModel,
      input: {
        prompt,
        duration: 5,
        aspect_ratio: aspectRatio,
      },
    })

    let finalPrediction = prediction
    const deadline = Date.now() + 5 * 60 * 1000
    while (["starting", "processing"].includes(finalPrediction.status)) {
      if (Date.now() > deadline)
        throw new Error("Replicate video generation timed out")
      await new Promise((r) => setTimeout(r, 5000))
      finalPrediction = await replicate.predictions.get(finalPrediction.id)
    }

    if (finalPrediction.status !== "succeeded") {
      throw new Error(
        `Replicate video failed with status: ${finalPrediction.status}`,
      )
    }

    const videoUrl = Array.isArray(finalPrediction.output)
      ? finalPrediction.output[0]
      : finalPrediction.output
    if (!videoUrl) throw new Error("Replicate generated no video URL")

    const uploaded = await upload({
      url: videoUrl,
      messageId,
      options: { type: "video", title: prompt.substring(0, 50) },
    })

    return {
      url: uploaded.url,
      prompt,
      provider: "replicate",
      model: replicateModel,
    }
  }

  try {
    if (providerToTry === "fal") {
      return await tryFal()
    } else {
      return await tryReplicate()
    }
  } catch (error: any) {
    if (providerToTry === "fal" && apiKey) {
      console.warn("⚠️ Fal.ai video failed, falling back to Replicate...", error)
      try {
        return await tryReplicate()
      } catch (replicateError) {
        console.error(
          "❌ Both Fal.ai and Replicate video failed:",
          replicateError,
        )
        throw replicateError
      }
    }
    console.error(`❌ Video generation failed (${providerToTry}):`, error)
    captureException(error)
    throw error
  }
}
