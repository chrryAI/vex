import { expect, test } from "vitest"
import { redact } from "./redaction"

test("server redact should redact emails", async () => {
  const input = "Contact me at test@example.com for more info."
  const result = await redact(input)
  // Check if it contains REDACTED or similar placeholder
  expect(result).toMatch(/\[?REDACTED\]?/i)
  expect(result).not.toContain("test@example.com")
})

test("server redact should redact phone numbers", async () => {
  const input = "Call me at 123-456-7890."
  const result = await redact(input)
  expect(result).toMatch(/\[?REDACTED\]?/i)
  expect(result).not.toContain("123-456-7890")
})

test("server redact should handle empty strings", async () => {
  expect(await redact("")).toBe("")
})

test("server redact should not change safe text", async () => {
  const input = "Hello world, this is a safe message."
  expect(await redact(input)).toBe(input)
})
