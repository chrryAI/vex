import { BskyAgent, RichText } from "@atproto/api"
import { type app, decrypt } from "@repo/db"
import sharp from "sharp"

interface BlueskyCredentials {
  handle: string
  password: string
}

interface BlueskyPostOptions {
  text: string
  credentials: BlueskyCredentials
  images?: string[] // Array of image URLs
  video?: string // Video URL
}

export async function postToBluesky({
  text,
  credentials,
  images,
  video,
}: BlueskyPostOptions): Promise<{ uri: string; cid: string }> {
  try {
    const agent = new BskyAgent({ service: "https://bsky.social" })

    await agent.login({
      identifier: credentials.handle,
      password: credentials.password,
    })

    let embed: any

    // Handle video attachment (highest priority for Bluesky)
    if (video) {
      try {
        console.log(`🎬 Uploading video to Bluesky: ${video}`)
        const videoResponse = await fetch(video)
        const videoBlob = await videoResponse.blob()
        const videoArrayBuffer = await videoBlob.arrayBuffer()
        const videoUint8Array = new Uint8Array(videoArrayBuffer)

        // Native video upload requires talking to video.bsky.app
        // We can use the same session token but different service
        const videoService = "https://video.bsky.app"

        // Use manual fetch for video service to avoid agent service switching complexity
        const uploadUrl = `${videoService}/xrpc/app.bsky.video.uploadVideo`
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": videoBlob.type || "video/mp4",
            Authorization: `Bearer ${agent.session?.accessJwt}`,
          },
          body: videoUint8Array,
        })

        if (!uploadRes.ok) {
          const errText = await uploadRes.text()
          throw new Error(
            `Failed to upload video: ${uploadRes.status} ${errText}`,
          )
        }

        const uploadData = await uploadRes.json()
        const jobId = uploadData.jobId

        if (!jobId) {
          throw new Error("No jobId returned from video upload")
        }

        console.log(
          `⏳ Video upload job started: ${jobId}, polling for status...`,
        )

        // Poll for completion (max 5 minutes)
        let videoBlobRef: any = null
        const startTime = Date.now()
        while (Date.now() - startTime < 300000) {
          const statusUrl = `${videoService}/xrpc/app.bsky.video.getJobStatus?jobId=${jobId}`
          const statusRes = await fetch(statusUrl, {
            headers: {
              Authorization: `Bearer ${agent.session?.accessJwt}`,
            },
          })

          if (statusRes.ok) {
            const statusData = await statusRes.json()
            const job = statusData.job

            if (job.status === "job_completed") {
              videoBlobRef = job.blob
              console.log("✅ Video processing completed successfully")
              break
            } else if (job.status === "job_failed") {
              throw new Error(
                `Video processing failed: ${job.error || "Unknown error"}`,
              )
            } else {
              console.log(`⏳ Video status: ${job.status}...`)
            }
          }

          // Wait 5 seconds before next poll
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }

        if (videoBlobRef) {
          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlobRef,
          }
        } else {
          throw new Error("Video processing timed out")
        }
      } catch (err) {
        console.error("⚠️ Failed to upload video to Bluesky:", err)
      }
    }
    // Handle image attachments (only if no video)
    else if (images && images.length > 0) {
      try {
        const imageEmbeds = []
        for (const imageUrl of images.slice(0, 4)) {
          // Bluesky limit is 4 images
          console.log(`🖼️ Uploading image to Bluesky: ${imageUrl}`)
          const response = await fetch(imageUrl)
          const blob = await response.blob()
          const arrayBuffer = await blob.arrayBuffer()
          let uint8Array = new Uint8Array(arrayBuffer)
          let mimeType = blob.type || "image/jpeg"

          // Bluesky has a ~1MB limit per image (specifically 976.56KB)
          // If the image is too large, we compress it using sharp
          if (uint8Array.length > 900 * 1024) {
            console.log(
              `🗜️ Image too large (${(uint8Array.length / 1024 / 1024).toFixed(2)}MB), compressing...`,
            )
            try {
              const compressedBuffer = await sharp(uint8Array)
                .resize({
                  width: 1000,
                  withoutEnlargement: true,
                  kernel: sharp.kernel.lanczos3,
                })
                .jpeg({
                  quality: 80,
                  progressive: true,
                })
                .toBuffer()

              uint8Array = new Uint8Array(compressedBuffer)
              mimeType = "image/jpeg"
              console.log(
                `✅ Compressed image: ${(uint8Array.length / 1024).toFixed(1)}KB`,
              )
            } catch (sharpError) {
              console.error(
                "⚠️ Sharp compression failed, trying anyway:",
                sharpError,
              )
            }
          }

          const uploadResponse = await agent.uploadBlob(uint8Array, {
            encoding: mimeType,
          })

          if (uploadResponse.data.blob) {
            imageEmbeds.push({
              image: uploadResponse.data.blob,
              alt: "", // Optional: add alt text if available
            })
          }
        }

        if (imageEmbeds.length > 0) {
          embed = {
            $type: "app.bsky.embed.images",
            images: imageEmbeds,
          }
        }
      } catch (err) {
        console.error("⚠️ Failed to upload images to Bluesky:", err)
      }
    }

    const rt = new RichText({ text })
    await rt.detectFacets(agent)

    const response = await agent.post({
      text: rt.text,
      facets: rt.facets,
      embed,
      createdAt: new Date().toISOString(),
    })

    console.log(`✅ Posted to Bluesky (@${credentials.handle}):`, response.uri)
    return response
  } catch (error) {
    throw error
  }
}

// Get Bluesky credentials for an app
export async function getBlueskyCredentials({
  app,
}: {
  app: app
}): Promise<BlueskyCredentials | null> {
  if (!app) {
    return null
  }

  const handle =
    app.blueskyHandle ||
    process.env[`BLUESKY_HANDLE_${app.slug.toUpperCase()}`] ||
    "tribeai.bluesky.social"
  const password = app.blueskyPassword
    ? await decrypt(app.blueskyPassword)
    : process.env[`BLUESKY_PASSWORD_${app.slug.toUpperCase()}`] ||
      process.env.BLUESKY_PASSWORD_TRIBE

  const appSlug = app.slug
  if (!handle || !password) {
    console.warn(`⚠️ Bluesky credentials not found for app: ${appSlug}`)
    return null
  }

  return { handle, password }
}
