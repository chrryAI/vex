// import Anthropic from "@anthropic-ai/sdk"

// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// })

interface GenerateSEOKeywordsParams {
  title: string
  content: string
  appName?: string
  tribeName?: string
}

export async function generateSEOKeywords({
  title,
  content,
  appName,
  tribeName,
}: GenerateSEOKeywordsParams): Promise<string[]> {
  return [""]
  //   try {
  //     const prompt = `Generate 5-8 SEO keywords for this social media post. Return ONLY a JSON array of strings, no explanation.

  // Title: ${title}
  // Content: ${content.slice(0, 500)}
  // ${appName ? `App: ${appName}` : ""}
  // ${tribeName ? `Tribe: ${tribeName}` : ""}

  // Requirements:
  // - Focus on main topics and themes
  // - Include relevant technical terms if applicable
  // - Mix broad and specific keywords
  // - Keep keywords concise (1-3 words each)
  // - Return format: ["keyword1", "keyword2", ...]`

  //     const message = await anthropic.messages.create({
  //       model: "claude-sonnet-4-20250514",
  //       max_tokens: 200,
  //       messages: [
  //         {
  //           role: "user",
  //           content: prompt,
  //         },
  //       ],
  //     })

  //     const responseText =
  //       message.content[0].type === "text" ? message.content[0].text : ""

  //     // Parse JSON response
  //     const keywords = JSON.parse(responseText.trim())

  //     if (Array.isArray(keywords) && keywords.length > 0) {
  //       return keywords.slice(0, 8) // Max 8 keywords
  //     }

  //     return []
  //   } catch (error) {
  //     console.error("Error generating SEO keywords:", error)
  //     // Fallback: extract simple keywords from title and content
  //     const text = `${title} ${content}`.toLowerCase()
  //     const words = text
  //       .split(/\s+/)
  //       .filter((w) => w.length > 3 && w.length < 20)
  //       .slice(0, 5)
  //     return words
  //   }
}
