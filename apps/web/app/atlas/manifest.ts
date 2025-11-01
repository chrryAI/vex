import { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas - AI Travel Companion",
    short_name: "Atlas",
    description:
      "Your intelligent travel companion that learns your preferences and provides personalized recommendations for every journey.",
    start_url: "/atlas",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    scope: "/",
    categories: ["travel", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/images/apps/atlas.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
