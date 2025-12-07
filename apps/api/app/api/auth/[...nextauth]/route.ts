import NextAuth from "next-auth"
import { authOptions } from "./options"

// Force dynamic evaluation for this route

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
