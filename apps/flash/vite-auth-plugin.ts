import { Plugin } from "vite"
import { auth } from "../api/hono/lib/better-auth"

/**
 * Vite plugin to handle Better Auth routes directly in the Vite dev server
 */
export function betterAuthPlugin(): Plugin {
  return {
    name: "better-auth-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle /auth/* routes
        if (!req.url?.startsWith("/auth")) {
          return next()
        }

        console.log("🟢 Vite auth middleware hit:", req.url)

        try {
          // Create a Web Request object for Better Auth
          const protocol = req.headers["x-forwarded-proto"] || "http"
          const host = req.headers.host || "localhost:5173"
          const url = `${protocol}://${host}${req.url}`

          // Collect request body if present
          let body: string | undefined
          if (req.method === "POST" || req.method === "PUT") {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            body = Buffer.concat(chunks).toString()
          }

          // Create Web API Request
          const request = new Request(url, {
            method: req.method,
            headers: req.headers as HeadersInit,
            body: body,
          })

          // Call Better Auth handler
          const response = await auth.handler(request)

          // Send response back to client
          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })

          const responseBody = await response.text()
          res.end(responseBody)
        } catch (error) {
          console.error("🔴 Better Auth error:", error)
          res.statusCode = 500
          res.end("Internal Server Error")
        }
      })
    },
  }
}
