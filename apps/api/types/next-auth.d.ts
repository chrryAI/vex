import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Extends the built-in session types to include custom properties
   */
  interface Session {
    token?: string
    user: {
      id?: string
      email?: string
      name?: string
      image?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name?: string
    image?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    token?: string
    id?: string
  }
}
