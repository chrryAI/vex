/**
 * Simple redaction utility for client-side usage.
 * Replaces email addresses and phone numbers with [REDACTED].
 */
export const simpleRedact = (text: string): string => {
  if (!text) return text

  // Redact Emails
  // Basic regex: \b[\w\.-]+@[\w\.-]+\.\w{2,4}\b
  const redactedEmails = text.replace(
    /\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g,
    "[REDACTED]",
  )

  // Redact Phone Numbers
  // Basic regex to catch common formats like:
  // (123) 456-7890
  // 123-456-7890
  // 123 456 7890
  // +1 123 456 7890
  const redactedPhones = redactedEmails.replace(
    /(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g,
    "[REDACTED]",
  )

  return redactedPhones
}
