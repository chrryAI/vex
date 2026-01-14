import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "dev.chrry",
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
      serverClientId:
        "1099191364859-grebmmhilo1j0voe674rvl6guujr5bnh.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
}

export default config
