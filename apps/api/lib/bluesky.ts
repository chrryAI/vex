import { BskyAgent, RichText } from "@atproto/api"
import { type app, decrypt } from "@repo/db"

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
}: BlueskyPostOptions): Promise<{ uri: string; cid: string } | null> {
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
        const response = await fetch(video)
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        const uploadResponse = await agent.uploadBlob(uint8Array, {
          encoding: blob.type || "video/mp4",
        })

        if (uploadResponse.data.blob) {
          embed = {
            $type: "app.bsky.embed.video",
            video: uploadResponse.data.blob,
          }
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
          const uint8Array = new Uint8Array(arrayBuffer)

          const uploadResponse = await agent.uploadBlob(uint8Array, {
            encoding: blob.type || "image/jpeg",
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
    console.error(
      `❌ Failed to post to Bluesky (@${credentials.handle}):`,
      error,
    )
    return null
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
