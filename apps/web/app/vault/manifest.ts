import { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vault - Smart Finance",
    short_name: "Vault",
    description:
      "AI-powered financial insights that help you make smarter money decisions. Track spending, optimize investments, and achieve your financial goals.",
    start_url: "/vault",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    scope: "/",
    categories: ["finance", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/images/apps/vault.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
