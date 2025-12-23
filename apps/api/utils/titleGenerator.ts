import { isE2E, VEX_LIVE_FINGERPRINTS } from "@chrryai/chrry/utils"
import { generateText } from "ai"
import { faker } from "@faker-js/faker"
import captureException from "../lib/captureException"
import { getThread, getPureApp } from "@repo/db"
import { getModelProvider } from "../lib/getModelProvider"

export const trimTitle = (str: string) =>
  str.slice(0, 50) + (str.length > 50 ? "..." : "")

export async function generateThreadTitle({
  messages,
  instructions,
  language = "en",
  threadId,
}: {
  messages: string[] | Array<{ threadId?: string; content: string }>
  instructions?: string | null
  language?: string
  threadId?: string
}): Promise<string> {
  const user = messages[0].user
  const guest = messages[0].guest

  const fingerprint = user?.fingerprint || guest?.fingerprint
  if (isE2E && !VEX_LIVE_FINGERPRINTS.includes(fingerprint))
    return faker.lorem.sentence()

  const thread = await getThread({
    id: threadId,
  })

  if (!thread) return ""

  const app = thread.appId
    ? await getPureApp({
        id: thread.appId,
      })
    : undefined

  try {
    // Supported languages for title generation
    const languageNames: Record<string, string> = {
      de: "German",
      en: "English",
      es: "Spanish",
      fr: "French",
      ja: "Japanese",
      ko: "Korean",
      pt: "Portuguese",
      zh: "Chinese",
    }

    // Use supported language or fallback to English
    const languageName = languageNames[language] || "English"
    const isUnsupportedLanguage = !languageNames[language] && language !== "en"

    if (isUnsupportedLanguage) {
      console.warn(
        `Unsupported language '${language}' for title generation, using English fallback`,
      )
    }

    // Use first message or combine multiple messages for context
    const conversationContext =
      messages.length === 1
        ? `User's first message: "${messages[0]}"`
        : `Conversation summary:\n${messages.slice(0, 5).join("\n\n")}`

    const contextPrompt = instructions
      ? `Context: The user has custom instructions: "${instructions}"\n\n${conversationContext}`
      : conversationContext

    const prompt = `Generate a concise, descriptive title for this conversation thread in ${languageName}.

${contextPrompt}

Requirements:
- Maximum 70 characters
- Capture the main topic/intent
- Use ${languageName} language
- Be specific and clear
- No quotes, parentheses, or character counts
- Just return the title text only

Title:`

    // Get the thread and app to determine which agent to use

    // Fallback to default if no model found
    const { provider: model } = await getModelProvider(app)

    if (!model) {
      return "New Conversation"
    }
    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.3,
    })

    // Clean and truncate the title
    const cleanTitle = text
      .trim()
      .replace(/^["']|["']$/g, "") // Remove quotes
      .substring(0, 50) // Ensure max length
      .trim()

    return cleanTitle || "New Conversation"
  } catch (error) {
    captureException(error)
    console.error("Error generating thread title:", error)
    return "New Conversation"
  }
}

export async function generateThreadInstructions({
  messages,
  currentInstructions,
  language = "en",
  threadId,
}: {
  messages: string[] | Array<{ threadId?: string; content: string }>
  currentInstructions?: string | null
  language?: string
  threadId?: string
}): Promise<string> {
  const user = messages[0].user
  const guest = messages[0].guest

  const fingerprint = user?.fingerprint || guest?.fingerprint
  if (isE2E && !VEX_LIVE_FINGERPRINTS.includes(fingerprint))
    return faker.lorem.sentence()

  const thread = await getThread({
    id: threadId,
  })

  if (!thread) return ""

  const app = thread.appId
    ? await getPureApp({
        id: thread.appId,
      })
    : undefined

  try {
    // Supported languages
    const languageNames: Record<string, string> = {
      de: "German",
      en: "English",
      es: "Spanish",
      fr: "French",
      ja: "Japanese",
      ko: "Korean",
      pt: "Portuguese",
      zh: "Chinese",
    }

    const languageName = languageNames[language] || "English"

    // Analyze conversation patterns
    const conversationAnalysis = messages.slice(0, 10).join("\n\n")

    const currentInstructionsContext = currentInstructions
      ? `\n\nCurrent instructions: "${currentInstructions}"`
      : "\n\nNo current instructions set."

    const prompt = `Based on this conversation, write natural instructions for an AI assistant to be most helpful for this specific user and topic.

Conversation:
${conversationAnalysis}${currentInstructionsContext}

Write instructions that:
- Sound natural and user-friendly (not like system prompts)
- Are specific to what this user needs help with
- Include the main topic/domain if clear (coding, business, writing, etc.)
- Mention preferred communication style if evident
- Are concise but comprehensive (aim for 200-400 characters)

Examples of good instructions:
- "Help me with ios app development. Focus on SwiftUI, provide code examples, and explain Apple's guidelines clearly."
- "Assist with creative writing projects. Give constructive feedback, suggest improvements, and help with plot development."
- "Support my business planning. Be direct, focus on actionable advice, and help with market analysis."

Write in ${languageName}. Return only the instruction text:`

    // Extract threadId from first message if not provided
    const extractedThreadId =
      threadId ||
      (messages.length > 0 &&
      typeof messages[0] === "object" &&
      "threadId" in messages[0]
        ? messages[0].threadId
        : undefined)

    // Get the thread and app to determine which agent to use

    const { provider: model } = await getModelProvider(app)

    if (!model) {
      return ""
    }

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.4,
    })

    // Clean and validate the instructions
    const cleanInstructions = text
      .trim()
      .replace(/^["']|["']$/g, "") // Remove quotes
      .substring(0, 500) // Ensure max length
      .trim()

    return (
      cleanInstructions ||
      "Help me with my questions and tasks in a helpful, concise manner."
    )
  } catch (error) {
    captureException(error)
    console.error("Error generating thread instructions:", error)
    return "Help me with my questions and tasks in a helpful, concise manner."
  }
}
