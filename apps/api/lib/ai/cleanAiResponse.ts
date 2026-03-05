/**
 * Robustly cleans AI response text for JSON parsing.
 * Handles markdown code blocks, reasoning tags (<think>), and leading/trailing noise.
 */
export function cleanAiResponse(text: string): string {
  let cleaned = text.trim()

  // 1. Remove reasoning blocks (<think>...</think>)
  // Some models like Qwen or DeepSeek R1 include their internal "thoughts" in these tags.
  // We use a non-greedy regex to remove all such blocks.
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "")

  // 2. Extract content from markdown code blocks (```json ... ``` or ``` ... ```)
  // Only extract if it looks like the AI wrapped the response in a block (doesn't already start with JSON)
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim()
    }
  }

  // 3. Final trim and safety check for common AI output issues
  cleaned = cleaned.trim()

  // If the response starts with something like "Here is the JSON:" or contains text before the first '{' or '['
  // we try to find the actual JSON boundaries.
  const firstBrace = cleaned.indexOf("{")
  const firstBracket = cleaned.indexOf("[")

  let startIndex = -1
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace
  } else if (firstBracket !== -1) {
    startIndex = firstBracket
  }

  if (startIndex > 0) {
    cleaned = cleaned.substring(startIndex)
  }

  // Similar logic for the end of the string
  const lastBrace = cleaned.lastIndexOf("}")
  const lastBracket = cleaned.lastIndexOf("]")

  let endIndex = -1
  if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) {
    endIndex = lastBrace
  } else if (lastBracket !== -1) {
    endIndex = lastBracket
  }

  if (endIndex !== -1 && endIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, endIndex + 1)
  }

  return cleaned
}
