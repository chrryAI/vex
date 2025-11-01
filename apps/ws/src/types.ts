// Type definitions for WS server
// Copied from packages/ui to avoid workspace dependency issues in Docker

export type User = {
  id: string
  email: string
  name?: string
  image?: string
  createdAt: Date
  updatedAt: Date
}

export type NewUser = {
  email: string
  name?: string
  image?: string
  password?: string
}
