import { simpleRedact } from "@chrryai/chrry/lib/redaction"
// @ts-ignore

export async function redact(text?: string | null): Promise<string | null> {
  if (!text) return text ?? null

  return simpleRedact(text)
}
