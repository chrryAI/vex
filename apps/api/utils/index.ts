import parseJson, { JSONError } from "parse-json"
import type { messageActionType } from "@repo/db"

export const getMetadata = ({
  // manifest = "/manifest.webmanifest",
  title = "Vex - 🥰 Your personal AI assistant",
  description = "Chat with AI, analyze files, and boost productivity in any language",
  keywords = [
    "ai chat",
    "multilingual",
    "file analysis",
    "productivity",
    "GPT-5",
    "claude",
    "gemini",
    "voice input",
    "focus",
    "vex",
  ],
  robots,
  locale = "en",
  alternates,
}: {
  manifest?: string
  title?: string
  description?: string
  keywords?: string[]
  locale?: string
  robots?: {
    index: boolean
    follow: boolean
  }
  alternates?: {
    canonical?: string
    languages?: Record<string, string>
  }
} = {}) => {
  const metadata = {
    metadataBase: new URL("https://chrry.dev"),
    alternates: alternates
      ? alternates
      : {
          canonical: "./",
        },
    title,
    icons: ["/icon.ico"],
    description,
    ...(keywords.length > 0 && { keywords: keywords.join(", ") }),
    openGraph: {
      title,
      description,
      url: "https://chrry.dev",
      siteName: "Chrry",
      images: [
        {
          url: "https://chrry.ai/logo/logo-512-512.png",
          width: 512,
          height: 512,
        },
      ],
      locale,
      type: "website",
    },
    twitter: {
      title,
      description,
      card: "summary",
      site: "https://chrry.dev",
      creator: "@chrryAI",
      images: [
        {
          url: "https://chrry.ai/logo/logo-1200-630.png",
          width: 1200,
          height: 630,
        },
      ],
    },
    robots,
    // manifest,
  }

  return metadata
}

export const extractActionFromResponse = (
  aiResponse: string,
): { actions: messageActionType[] | null; cleanedText: string } => {
  let actions: messageActionType[] | null = null
  let cleanedText = aiResponse.trim()

  // Method 1: Look for ACTION: [{...}] pattern (multiline support)
  const actionMatch = aiResponse.match(/ACTION:\s*([\s\S]*?)(?=\n\n|$)/)

  // Extract just the JSON part (array or object)
  let jsonPart = null
  if (actionMatch && actionMatch[1]) {
    const actionContent = actionMatch[1].trim()
    // Look for array format first
    const arrayMatch = actionContent.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      jsonPart = arrayMatch[0]
    }
  }
  if (jsonPart) {
    try {
      console.log(`🔍 DEBUG: Raw ACTION JSON found:`, jsonPart)

      // Use parse-json for better error handling and more reliable parsing
      const actionData = parseJson(jsonPart, "AI-ACTION-JSON")
      console.log(`✅ DEBUG: Successfully parsed ACTION JSON:`, actionData)

      // Handle ONLY array format: [{"type": "...", "params": {...}}]
      if (Array.isArray(actionData)) {
        actions = actionData.filter((item) => item.type) // Filter valid actions
        cleanedText = aiResponse.replace(/ACTION:\s*\[.*?\]\s*$/, "").trim()
        return { actions: actions, cleanedText }
      }

      // If not an array, reject - we only support arrays now
      console.log(
        "❌ Action must be an array format: [{...}], got:",
        typeof actionData,
      )
    } catch (error) {
      if (error instanceof JSONError) {
        console.log("❌ JSON Parse Error with helpful details:")
        console.log("Error message:", error.message)
        console.log("Code frame:", error.codeFrame)
        console.log("Raw code frame:", error.rawCodeFrame)
      } else {
        console.log("❌ Failed to parse ACTION JSON:", error)
      }
      console.log("Raw AI response:", aiResponse)

      // Fallback: Try to extract action type and basic params manually
      const typeMatch = jsonPart.match(/["']?type["']?\s*:\s*["']([^"']+)["']/)
      const reasonMatch = jsonPart.match(
        /["']?reason["']?\s*:\s*["']([^"']+)["']/,
      )
      const semanticTargetMatch = jsonPart.match(
        /["']?semanticTarget["']?\s*:\s*["']([^"']+)["']/,
      )
      const targetKeywordsMatch = jsonPart.match(
        /["']?targetKeywords["']?\s*:\s*\[([^\]]+)\]/,
      )

      if (typeMatch && typeMatch[1]) {
        console.log(`🔧 FALLBACK: Extracted action type: ${typeMatch[1]}`)

        const params: any = {
          reason: reasonMatch?.[1] || "AI suggested action",
        }

        if (semanticTargetMatch?.[1]) {
          params.semanticTarget = semanticTargetMatch[1]
        }

        if (targetKeywordsMatch?.[1]) {
          try {
            const keywordsStr = targetKeywordsMatch[1].replace(/["']/g, '"')
            params.targetKeywords = JSON.parse(`[${keywordsStr}]`)
          } catch (_e) {
            // Simple split fallback
            params.targetKeywords = targetKeywordsMatch[1]
              .split(",")
              .map((k) => k.trim().replace(/["']/g, ""))
              .filter((k) => k.length > 0)
          }
        }

        const singleAction = {
          type: typeMatch[1] as any,
          params,
        }
        actions = [singleAction] // Wrap single action in array

        cleanedText = aiResponse
          .replace(/ACTION:\s*\{(?:[^{}]|\{[^}]*\})*\}\s*$/, "")
          .trim()

        console.log(`✅ FALLBACK: Successfully extracted action:`, actions)
        return { actions: actions, cleanedText }
      }
    }
  }

  // Method 2: REMOVED - Only arrays are supported now
  // Direct JSON objects like {"type": "...", "params": {...}} are no longer supported
  // AI must always respond with arrays: [{"type": "...", "params": {...}}]

  // Method 3: Fallback parsing for booking analysis responses (ONLY if no actions found yet)
  if (
    !actions &&
    (aiResponse.includes("click") || aiResponse.includes("Click"))
  ) {
    // Extract element index from various patterns
    const indexMatches = [
      aiResponse.match(/elementIndex["']?\s*:\s*([0-9]+)/i),
      aiResponse.match(/index[\s:]*([0-9]+)/i),
      aiResponse.match(/element[\s[]*([0-9]+)/i),
      aiResponse.match(/\[([0-9]+)\]/),
    ].find((match) => match)

    if (indexMatches && indexMatches[1]) {
      const elementIndex = Number.parseInt(indexMatches[1])
      if (!isNaN(elementIndex)) {
        const singleAction = {
          type: "click_element",
          params: {
            elementIndex,
            reason: "AI analysis suggests clicking this element",
          },
        }
        actions = [singleAction] // Wrap single action in array
        return { actions: actions, cleanedText }
      }
    }
  }

  // If no action found, return status message
  if (!actions) {
    cleanedText = aiResponse
  }

  return { actions: actions, cleanedText }
}
