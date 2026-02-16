import { simpleRedact } from "@chrryai/chrry/lib/redaction"

export async function redact(text?: string | null): Promise<string | null> {
  if (!text) return text ?? null

  return simpleRedact(text)
}
