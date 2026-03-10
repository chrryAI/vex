import { BskyAgent } from "@atproto/api"
import { type app, decrypt } from "@repo/db"

interface BlueskyCredentials {
  handle: string
  password: string
}

interface BlueskyPostOptions {
  text: string
  credentials: BlueskyCredentials
}

export async function postToBluesky({
  text,
  credentials,
}: BlueskyPostOptions): Promise<{ uri: string; cid: string } | null> {
  try {
    const agent = new BskyAgent({ service: "https://bsky.social" })

    await agent.login({
      identifier: credentials.handle,
      password: credentials.password,
    })

    const response = await agent.post({
      text,
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
    app.blueskyHandle || process.env[`BLUESKY_HANDLE_${app.slug.toUpperCase()}`]
  const password = app.blueskyPassword
    ? await decrypt(app.blueskyPassword)
    : process.env[`BLUESKY_PASSWORD_${app.slug.toUpperCase()}`]

  const appSlug = app.slug
  if (!handle || !password) {
    console.warn(`⚠️ Bluesky credentials not found for app: ${appSlug}`)
    return null
  }

  return { handle, password }
}
