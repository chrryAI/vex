import NextAuth from "next-auth"
import { authOptions } from "./options"

// Force dynamic evaluation for this route
export const dynamic = "force-dynamic"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
