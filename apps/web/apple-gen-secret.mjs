#!/usr/bin/env node

import { SignJWT } from "jose"
import { createPrivateKey } from "crypto"
import * as dotenv from "dotenv"

// Load environment variables
dotenv.config()

const teamId = process.env.APPLE_TEAM_ID
const clientId = process.env.APPLE_CLIENT_ID
const keyId = process.env.APPLE_KEY_ID

// Handle private key - it should be in PEM format
let privateKey = process.env.APPLE_PRIVATE_KEY
if (!privateKey) {
  console.error("Error: APPLE_PRIVATE_KEY environment variable is not set")
  process.exit(1)
}

// Replace literal \n with actual newlines
privateKey = privateKey.replace(/\\n/g, "\n")

// Ensure proper PEM format
if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
  privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`
}

// Default expiration is 6 months (180 days)
const expiresIn = 86400 * 180 // 180 days in seconds
const expirationTime = Math.ceil(Date.now() / 1000) + expiresIn

async function generateSecret() {
  try {
    const secret = await new SignJWT({})
      .setAudience("https://appleid.apple.com")
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .setSubject(clientId)
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .sign(createPrivateKey(privateKey))

    console.log(`
Apple client secret generated. Valid until: ${new Date(expirationTime * 1000)}
${secret}
    `)

    return secret
  } catch (error) {
    console.error("Error generating Apple client secret:", error)
    process.exit(1)
  }
}

generateSecret()
