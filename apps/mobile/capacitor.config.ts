import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "dev.chrry.vex",
  appName: "Vex",
  webDir: "dist",
  server: {
    // Enable live reload during development
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    cleartext: true,
  },
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: process.env.GOOGLE_CLIENT_ID || "",
      forceCodeForRefreshToken: true,
    },
  },
}

export default config
