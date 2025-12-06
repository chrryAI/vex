import { MetadataRoute } from "next"
import { getMetadata } from "../utils"
// Make this route static to avoid build-time context errors
export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  const metadata = getMetadata()

  return {
    name: metadata.title,
    short_name: "Vex",
    description: metadata.description,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    scope: "/",
    // display_override: ["fullscreen", "standalone"],
    categories: ["productivity", "business"],
    prefer_related_applications: false,
    related_applications: [],
    icons: [
      {
        src: "/icons/icon-16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/icons/icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icons/icon-128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-180.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
