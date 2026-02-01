import { captureException } from "@sentry/node"

const MOLTBOOK_API_BASE = "https://www.moltbook.com/api/v1"

interface MoltbookAgent {
  name: string
  description: string
  karma: number
  verified: boolean
  created_at: string
}

interface MoltbookPost {
  id: string
  title: string
  content?: string
  url?: string
  submolt: string
  author: string
  score: number
  created_at: string
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
) {
  const { timeout = 10000, ...fetchOptions } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

export async function getMoltbookTopAgents(
  limit = 10,
): Promise<MoltbookAgent[]> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/agents/top?limit=${limit}`,
    )

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status}`)
    }

    const data = await response.json()
    return data.agents || []
  } catch (error) {
    captureException(error)
    console.error("❌ Error fetching Moltbook top agents:", error)
    return []
  }
}

export async function getMoltbookFeed(
  apiKey: string,
  sort: "hot" | "new" | "top" | "rising" = "hot",
  limit = 25,
): Promise<MoltbookPost[]> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/posts?sort=${sort}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status}`)
    }

    const data = await response.json()
    return data.posts || []
  } catch (error) {
    captureException(error)
    console.error("❌ Error fetching Moltbook feed:", error)
    return []
  }
}

export async function postToMoltbook(
  apiKey: string,
  post: {
    submolt: string
    title: string
    content?: string
    url?: string
  },
): Promise<{ success: boolean; post_id?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${MOLTBOOK_API_BASE}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(post),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Moltbook API Error Response:", errorData)
      return {
        success: false,
        error:
          errorData.message || errorData.error || JSON.stringify(errorData),
      }
    }

    const data = await response.json()
    return { success: true, post_id: data.post.id }
  } catch (error) {
    captureException(error)
    console.error("❌ Error posting to Moltbook:", error)
    return { success: false, error: String(error) }
  }
}

export async function searchMoltbook(
  apiKey: string,
  query: string,
  limit = 25,
): Promise<{
  posts: MoltbookPost[]
  agents: MoltbookAgent[]
}> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      posts: data.posts || [],
      agents: data.agents || [],
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error searching Moltbook:", error)
    return { posts: [], agents: [] }
  }
}

export async function getAgentProfile(
  apiKey: string,
  agentName: string,
): Promise<MoltbookAgent | null> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/agents/profile?name=${encodeURIComponent(agentName)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status}`)
    }

    const data = await response.json()
    return data.agent || null
  } catch (error) {
    captureException(error)
    console.error("❌ Error fetching agent profile:", error)
    return null
  }
}
