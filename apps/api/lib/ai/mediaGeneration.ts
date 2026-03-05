// import * as fal from "@fal-ai/serverless-client"
// import Replicate from "replicate"
// import { v4 as uuidv4 } from "uuid"
// import { captureException } from "../captureException"
// import { upload } from "../minio"

// const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY
// const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY

// /**
//  * Image Generation Options
//  */
// export interface ImageGenerationOptions {
//   prompt: string
//   aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
//   model?: string // e.g. "flux-pro", "flux-dev"
//   provider?: "replicate" | "fal"
//   userId?: string
//   messageId?: string
//   apiKey?: string // Replicate API key override
//   falKey?: string // Fal API key override
// }

// /**
//  * Video Generation Options
//  */
// export interface VideoGenerationOptions {
//   prompt: string
//   aspectRatio?: "16:9" | "9:16"
//   duration?: number
//   model?: string
//   provider?: "replicate" | "fal"
//   userId?: string
//   messageId?: string
//   apiKey?: string // Replicate API key override
//   falKey?: string // Fal API key override
// }

// /**
//  * Unified Image Generation
//  */
// export async function generateImage(options: ImageGenerationOptions): Promise<{
//   url: string
//   prompt: string
//   provider: string
//   model: string
// }> {
//   const {
//     prompt,
//     aspectRatio = "1:1",
//     provider = options.falKey || FAL_KEY ? "fal" : "replicate",
//     model = "flux-pro",
//     messageId = uuidv4(),
//     apiKey = REPLICATE_API_KEY,
//     falKey = FAL_KEY,
//   } = options

//   console.log(
//     `🎨 Generating image via ${provider} (${model}): "${prompt.substring(0, 50)}..."`,
//   )

//   try {
//     if (provider === "fal") {
//       if (!falKey) throw new Error("Fal.ai API key is missing")

//       // Map model to fal model
//       const falModel =
//         model === "flux-pro" ? "fal-ai/flux-pro/v1.1" : "fal-ai/flux/dev"

//       // Configure fal-ai client with the key if provided
//       if (options.falKey) {
//         // Since we are using an imported client, this global config might affect other calls,
//         // but for a server request this is usually fine if handled per-request or if client is instantiated per-request.
//         // However, the fal client is a bit tricky with global config.
//       }

//       const result: any = await fal.subscribe(falModel, {
//         input: {
//           prompt,
//           image_size:
//             aspectRatio === "1:1"
//               ? "square"
//               : aspectRatio === "16:9"
//                 ? "landscape_16_9"
//                 : "portrait_9_16",
//         },
//         logs: true,
//       })

//       const imageUrl = result.images?.[0]?.url
//       if (!imageUrl) throw new Error("Fal.ai generated no image URL")

//       // Upload to our own storage (Minio/S3)
//       const uploaded = await upload({
//         url: imageUrl,
//         messageId,
//         options: { type: "image", title: prompt.substring(0, 50) },
//       })

//       return {
//         url: uploaded.url,
//         prompt,
//         provider: "fal",
//         model: falModel,
//       }
//     } else {
//       // Replicate fallback
//       if (!apiKey) throw new Error("Replicate API key is missing")
//       const replicate = new Replicate({ auth: apiKey })

//       const replicateModel = "black-forest-labs/flux-1.1-pro"
//       const output = await replicate.run(replicateModel as any, {
//         input: {
//           prompt,
//           aspect_ratio: aspectRatio,
//           output_format: "webp",
//         },
//       })

//       let imageUrl: string | undefined
//       if (Array.isArray(output)) imageUrl = output[0]
//       else if (typeof output === "string") imageUrl = output
//       else if (output && typeof (output as any).url === "function") {
//         imageUrl = (await (output as any).url()).href
//       }

//       if (!imageUrl) throw new Error("Replicate generated no image URL")

//       const uploaded = await upload({
//         url: imageUrl,
//         messageId,
//         options: { type: "image", title: prompt.substring(0, 50) },
//       })

//       return {
//         url: uploaded.url,
//         prompt,
//         provider: "replicate",
//         model: replicateModel,
//       }
//     }
//   } catch (error) {
//     console.error(`❌ Image generation failed (${provider}):`, error)
//     captureException(error)
//     throw error
//   }
// }

// /**
//  * Unified Video Generation
//  */
// export async function generateVideo(options: VideoGenerationOptions): Promise<{
//   url: string
//   prompt: string
//   provider: string
//   model: string
// }> {
//   const {
//     prompt,
//     aspectRatio = "16:9",
//     provider = options.falKey || FAL_KEY ? "fal" : "replicate",
//     model = "kling-v1.5",
//     messageId = uuidv4(),
//     apiKey = REPLICATE_API_KEY,
//     falKey = FAL_KEY,
//   } = options

//   console.log(
//     `🎬 Generating video via ${provider} (${model}): "${prompt.substring(0, 50)}..."`,
//   )

//   try {
//     if (provider === "fal") {
//       if (!falKey) throw new Error("Fal.ai API key is missing")

//       // Use Kling v1.5 as default on Fal (more stable than Luma currently)
//       const falModel =
//         model === "luma-ray"
//           ? "fal-ai/luma-dream-machine/ray-2"
//           : "fal-ai/kling-video/v1.5/pro/text-to-video"

//       // Configure fal-ai client with the key
//       if (typeof (fal as any).config === "function") {
//         ;(fal as any).config({ credentials: falKey })
//       }

//       const input = {
//         prompt,
//         aspect_ratio: aspectRatio, // Kling supports 16:9, 9:16, 1:1
//       }

//       console.log(`🎬 Fal.ai Video Generation (${falModel}):`, input)

//       const result: any = await fal.subscribe(falModel, {
//         input,
//         logs: true,
//       })

//       const videoUrl =
//         result.video?.url || result.images?.[0]?.url || result.url
//       if (!videoUrl) throw new Error("Fal.ai generated no video URL")

//       const uploaded = await upload({
//         url: videoUrl,
//         messageId,
//         options: { type: "video", title: prompt.substring(0, 50) },
//       })

//       return {
//         url: uploaded.url,
//         prompt,
//         provider: "fal",
//         model: falModel,
//       }
//     } else {
//       // Replicate fallback (Luma Ray)
//       if (!apiKey) throw new Error("Replicate API key is missing")
//       const replicate = new Replicate({ auth: apiKey })

//       const replicateModel = "luma/ray-2-540p"
//       const prediction = await replicate.predictions.create({
//         model: replicateModel,
//         input: {
//           prompt,
//           duration: 5,
//           aspect_ratio: aspectRatio,
//         },
//       })

//       // Polling for Replicate
//       let finalPrediction = prediction
//       const deadline = Date.now() + 5 * 60 * 1000
//       while (["starting", "processing"].includes(finalPrediction.status)) {
//         if (Date.now() > deadline)
//           throw new Error("Replicate video generation timed out")
//         await new Promise((r) => setTimeout(r, 5000))
//         finalPrediction = await replicate.predictions.get(finalPrediction.id)
//       }

//       if (finalPrediction.status !== "succeeded") {
//         throw new Error(
//           `Replicate video failed with status: ${finalPrediction.status}`,
//         )
//       }

//       const videoUrl = Array.isArray(finalPrediction.output)
//         ? finalPrediction.output[0]
//         : finalPrediction.output
//       if (!videoUrl) throw new Error("Replicate generated no video URL")

//       const uploaded = await upload({
//         url: videoUrl,
//         messageId,
//         options: { type: "video", title: prompt.substring(0, 50) },
//       })

//       return {
//         url: uploaded.url,
//         prompt,
//         provider: "replicate",
//         model: replicateModel,
//       }
//     }
//   } catch (error: any) {
//     if (provider === "fal" && error.body) {
//       console.error(
//         `❌ Fal.ai Error Details:`,
//         JSON.stringify(error.body, null, 2),
//       )
//     }
//     console.error(`❌ Video generation failed (${provider}):`, error)
//     captureException(error)
//     throw error
//   }
// }
