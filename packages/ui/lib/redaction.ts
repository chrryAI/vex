/**
 * Simple redaction utility for client-side usage.
 * Replaces email addresses and phone numbers with [REDACTED].
 */
export const simpleRedact = (text: string): string => {
  if (!text) return text

  // Redact Emails
  // Improved regex for broader support including longer TLDs
  const redactedEmails = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
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
