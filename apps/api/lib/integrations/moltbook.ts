import { captureException } from "../captureException"

const MOLTBOOK_API_BASE = "https://www.moltbook.com/api/v1"

export async function checkMoltbookHealth(
  apiKey: string,
): Promise<{ healthy: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${MOLTBOOK_API_BASE}/agents/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    })

    if (!response.ok) {
      return {
        healthy: false,
        error: `Moltbook API returned ${response.status}`,
      }
    }

    return { healthy: true }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

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
  author_id: string
  score: number
  created_at: string
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
) {
  const { timeout = 30000, ...fetchOptions } = options
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

export async function getMoltbookAgentInfo(
  apiKey: string,
): Promise<MoltbookAgent | null> {
  try {
    const response = await fetchWithTimeout(`${MOLTBOOK_API_BASE}/agents/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    })

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status}`)
    }

    const data = await response.json()
    return data.agent || data
  } catch (error) {
    captureException(error)
    console.error("❌ Error fetching Moltbook agent info:", error)
    return null
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
        timeout: 30000, // 30 seconds for slow Moltbook API
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
      captureException(new Error("❌ Moltbook API Error Response"))
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

interface MoltbookComment {
  id: string
  post_id?: string
  content: string
  created_at: string
  parent_id?: string | null
  upvotes: number
  downvotes: number
  author: {
    id: string
    name: string
    karma: number
    follower_count: number
  }
  replies: MoltbookComment[]
}

export async function getPostComments(
  apiKey: string,
  postId: string,
  sort: "top" | "new" | "controversial" = "top",
): Promise<MoltbookComment[]> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/posts/${postId}/comments?sort=${sort}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      // 404 means post was deleted - don't spam Sentry
      if (response.status === 404) {
        console.log(`⚠️ Post ${postId} not found (deleted from Moltbook)`)
        return []
      }
      throw new Error(`Moltbook API error: ${response.status}`)
    }

    const data = await response.json()
    return data.comments || []
  } catch (error) {
    // Only send to Sentry if it's not a 404
    if (
      !(error instanceof Error && error.message.includes("404")) &&
      !(error instanceof Error && error.message.includes("not found"))
    ) {
      captureException(error)
    }
    console.error(`❌ Error fetching comments for post ${postId}:`, error)
    return []
  }
}

export async function postComment(
  apiKey: string,
  postId: string,
  content: string,
  parentId?: string,
): Promise<{ success: boolean; comment_id?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/posts/${postId}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          parent_id: parentId,
        }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Moltbook Comment API Error:", errorData)
      captureException(new Error("❌ Moltbook Comment API Error"))
      return {
        success: false,
        error:
          errorData.message || errorData.error || JSON.stringify(errorData),
      }
    }

    const data = await response.json()
    return { success: true, comment_id: data.comment.id }
  } catch (error) {
    captureException(error)
    console.error("❌ Error posting comment to Moltbook:", error)
    return { success: false, error: String(error) }
  }
}

export async function followAgent(
  apiKey: string,
  agentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/agents/${agentId}/follow`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      let errorData: any = {}
      try {
        errorData = await response.json()
      } catch {
        // ignore non-JSON error bodies
      }

      // 404 means agent not found - don't spam Sentry
      if (response.status === 404) {
        console.log(`⚠️ Agent ${agentId} not found (may have been deleted)`)
        return {
          success: false,
          error: errorData.message || errorData.error || "Agent not found",
        }
      }

      // Handle other error statuses
      console.error("❌ Moltbook Follow API Error:", errorData)
      return {
        success: false,
        error:
          errorData.message ||
          errorData.error ||
          `Request failed with status ${response.status}`,
      }
    }

    return { success: true }
  } catch (error) {
    // Only send to Sentry if it's not a 404
    if (
      !(error instanceof Error && error.message.includes("404")) &&
      !(error instanceof Error && error.message.includes("not found"))
    ) {
      captureException(error)
    }
    console.error("❌ Error following agent on Moltbook:", error)
    return { success: false, error: String(error) }
  }
}

export async function unfollowAgent(
  apiKey: string,
  agentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/agents/${agentId}/follow`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Moltbook Unfollow API Error:", errorData)
      return {
        success: false,
        error:
          errorData.message || errorData.error || JSON.stringify(errorData),
      }
    }

    return { success: true }
  } catch (error) {
    captureException(error)
    console.error("❌ Error unfollowing agent on Moltbook:", error)
    return { success: false, error: String(error) }
  }
}

export async function votePost(
  apiKey: string,
  postId: string,
  direction: "up" | "down",
): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = direction === "up" ? "upvote" : "downvote"
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/posts/${postId}/${endpoint}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Moltbook Vote API Error:", errorData)
      return {
        success: false,
        error:
          errorData.message || errorData.error || JSON.stringify(errorData),
      }
    }

    return { success: true }
  } catch (error) {
    captureException(error)
    console.error("❌ Error voting on Moltbook post:", error)
    return { success: false, error: String(error) }
  }
}

export async function voteComment(
  apiKey: string,
  commentId: string,
  direction: "up" | "down",
): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = direction === "up" ? "upvote" : "downvote"
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/comments/${commentId}/${endpoint}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Moltbook Comment Vote API Error:", errorData)
      return {
        success: false,
        error:
          errorData.message || errorData.error || JSON.stringify(errorData),
      }
    }

    return { success: true }
  } catch (error) {
    captureException(error)
    console.error("❌ Error voting on Moltbook comment:", error)
    return { success: false, error: String(error) }
  }
}

export async function setupOwnerEmail(
  apiKey: string,
  email: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      `${MOLTBOOK_API_BASE}/agents/me/setup-owner-email`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Moltbook Setup Email API Error:", errorData)
      return {
        success: false,
        error:
          errorData.message || errorData.error || JSON.stringify(errorData),
      }
    }

    const data = await response.json()
    return {
      success: true,
      message: data.message || "Email setup initiated. Check your inbox!",
    }
  } catch (error) {
    captureException(error)
    console.error("❌ Error setting up owner email on Moltbook:", error)
    return { success: false, error: String(error) }
  }
}
