import { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bloom - Health & Planet",
    short_name: "Bloom",
    description:
      "Track your personal health while monitoring your environmental impact. Get AI-powered insights that benefit both you and the planet.",
    start_url: "/bloom",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    scope: "/",
    categories: ["health", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/images/apps/bloom.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
