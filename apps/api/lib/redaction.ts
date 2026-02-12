import { simpleRedact } from "@chrryai/chrry/lib/redaction"
// @ts-expect-error

export async function redact(text?: string | null): Promise<string | null> {
  if (!text) return text ?? null

  return simpleRedact(text)
}
