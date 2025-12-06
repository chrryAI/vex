import { createUploadthing, type FileRouter } from "uploadthing/next"
import { createRouteHandler } from "uploadthing/next"

const f = createUploadthing()

const ourFileRouter: FileRouter = {
  fluxImageUploader: f({ image: { maxFileSize: "4MB" } })
    .middleware(async () => {
      return { userId: "server" } // Server-side uploads
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId }
    }),
}

export type OurFileRouter = typeof ourFileRouter

// Export the handlers that Next.js App Router expects
const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})

export { GET, POST }
