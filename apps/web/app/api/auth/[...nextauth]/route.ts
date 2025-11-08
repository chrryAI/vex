import NextAuth from "next-auth"
import { authOptions } from "./options"
import { headers } from "next/headers"
import { getSiteConfig } from "chrry/utils/siteConfig"

// Force dynamic evaluation for this route
export const dynamic = "force-dynamic"

async function handler(req: Request) {
  // Get hostname from headers for dynamic URL handling
  const headersList = await headers()
  const host = headersList.get("host") || ""
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
  
  // Get site-specific URL
  const siteConfig = getSiteConfig(host)
  const baseUrl = siteConfig.url || `${protocol}://${host}`
  
  // Override NEXTAUTH_URL for this request
  process.env.NEXTAUTH_URL = baseUrl
  
  // Create handler with updated config
  const nextAuthHandler = NextAuth(authOptions)
  
  return nextAuthHandler(req)
}

export { handler as GET, handler as POST }
