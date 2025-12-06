import sharp from "sharp"

/**
 * Generate favicons for custom agents
 * Creates multiple sizes for PWA manifest
 */

interface FaviconOptions {
  text?: string // Emoji or 1-2 letter text
  backgroundColor?: string
  textColor?: string
  imageUrl?: string // If user uploads custom icon
}

/**
 * Generate all favicon sizes for an agent
 * Returns URLs to generated images
 */
export async function generateAgentFavicons(
  agentId: string,
  options: FaviconOptions,
): Promise<{
  icon16: string
  icon32: string
  icon48: string
  icon192: string
  icon512: string
}> {
  const sizes = [16, 32, 48, 192, 512]
  const results: Record<string, string> = {}

  for (const size of sizes) {
    const buffer = await generateFavicon(size, options)
    const filename = `icon-${size}.png`
    const path = `/agents/${agentId}/${filename}`

    // Save to public directory or S3/R2
    await saveFavicon(path, buffer)

    results[`icon${size}`] = path
  }

  return results as any
}

/**
 * Generate a single favicon size
 */
async function generateFavicon(
  size: number,
  options: FaviconOptions,
): Promise<Buffer> {
  const {
    text,
    backgroundColor = "#f87171",
    textColor = "#FFFFFF",
    imageUrl,
  } = options

  // If user uploaded custom image
  if (imageUrl) {
    return await sharp(imageUrl)
      .resize(size, size, {
        fit: "cover",
        position: "center",
      })
      .png()
      .toBuffer()
  }

  // Generate from text/emoji
  const fontSize = Math.floor(size * 0.6)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size * 0.15}"/>
      <text
        x="50%"
        y="50%"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="${textColor}"
        text-anchor="middle"
        dominant-baseline="central"
      >${text || "🤖"}</text>
    </svg>
  `

  return await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
}

/**
 * Save favicon to storage
 */
async function saveFavicon(path: string, buffer: Buffer): Promise<void> {
  // Option 1: Save to public directory (development)
  // if (process.env.NODE_ENV === "development") {
  //   const fs = await import("fs/promises")
  //   const fullPath = `./public${path}`
  //   const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
  //   await fs.mkdir(dir, { recursive: true })
  //   await fs.writeFile(fullPath, buffer)
  //   return
  // }
  // Option 2: Upload to R2/S3 (production)
  // TODO: Implement R2 upload
  // await uploadToR2(path, buffer)
}

/**
 * Generate favicon from emoji
 */
export async function generateEmojiIcon(
  emoji: string,
  size: number = 512,
  backgroundColor: string = "#f87171",
): Promise<Buffer> {
  return generateFavicon(size, {
    text: emoji,
    backgroundColor,
  })
}

/**
 * Generate favicon from initials
 */
export async function generateInitialsIcon(
  initials: string,
  size: number = 512,
  backgroundColor: string = "#f87171",
  textColor: string = "#FFFFFF",
): Promise<Buffer> {
  return generateFavicon(size, {
    text: initials.substring(0, 2).toUpperCase(),
    backgroundColor,
    textColor,
  })
}

/**
 * Generate gradient favicon
 */
export async function generateGradientIcon(
  text: string,
  size: number = 512,
  gradientStart: string = "#f87171",
  gradientEnd: string = "#7C3AED",
): Promise<Buffer> {
  const fontSize = Math.floor(size * 0.6)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.15}"/>
      <text
        x="50%"
        y="50%"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="central"
      >${text}</text>
    </svg>
  `

  return await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
}

/**
 * Example usage in agent creation
 */
export async function createAgentWithFavicons(agentData: {
  name: string
  displayName: string
  icon?: string // emoji, initials, or image URL
  themeColor?: string
}) {
  const agentId = "temp-id" // Will be replaced with actual ID

  let faviconOptions: FaviconOptions = {}

  // Detect icon type
  if (agentData.icon) {
    // Check if it's an emoji (1-2 characters)
    if (agentData.icon.length <= 2) {
      faviconOptions = {
        text: agentData.icon,
        backgroundColor: agentData.themeColor || "#f87171",
      }
    }
    // Check if it's a URL
    else if (agentData.icon.startsWith("http")) {
      faviconOptions = {
        imageUrl: agentData.icon,
      }
    }
    // Otherwise, use as initials
    else {
      faviconOptions = {
        text: agentData.icon.substring(0, 2).toUpperCase(),
        backgroundColor: agentData.themeColor || "#f87171",
      }
    }
  } else {
    // Generate from name initials
    const initials = agentData.displayName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase()

    faviconOptions = {
      text: initials,
      backgroundColor: agentData.themeColor || "#f87171",
    }
  }

  // Generate all favicon sizes
  const favicons = await generateAgentFavicons(agentId, faviconOptions)

  return {
    ...agentData,
    favicons,
  }
}
