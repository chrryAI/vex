import { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peach - AI Social Network",
    short_name: "Peach",
    description:
      "Connect with people through intelligent personality matching. Share experiences, find travel buddies, and build meaningful relationships powered by AI insights.",
    start_url: "/peach",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    scope: "/",
    categories: ["social", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/images/apps/peach.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
