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
  // Firebase Authentication plugin handles Google/Apple Sign-In configuration
  // No additional plugin config needed here
}

export default config
