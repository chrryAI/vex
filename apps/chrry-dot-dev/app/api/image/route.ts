import { NextRequest, NextResponse } from "next/server"
import slugify from "slug"
import { upload } from "../../../lib/uploadthing-server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { scanFileForMalware } from "../../../lib/security"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/image
 * Upload an app icon/logo image
 *
 * Body: FormData with:
 * - file: Image file
 * - draftId?: Optional draft ID to associate image with
 *
 * Returns: { success: true, url: string, draftId?: string }
 */
export async function POST(req: NextRequest) {
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = (await req.formData()) as unknown as FormData

  const { file, draftId } = Object.fromEntries(formData.entries()) as {
    file: File
    draftId?: string
  }

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "File must be an image" },
      { status: 400 },
    )
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "File size must be less than 5MB" },
      { status: 400 },
    )
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Scan for malware
    const scanResult = await scanFileForMalware(buffer)

    if (!scanResult.safe) {
      console.error("🚨 Malware detected in app image")
      return NextResponse.json(
        {
          error: `File failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        { status: 400 },
      )
    }

    const base64 = buffer.toString("base64")

    console.log("📤 Uploading app image:", {
      name: file.name,
      type: file.type,
      size: file.size,
      draftId,
    })

    // Upload with 500x500 dimensions for app icons
    const uploadResult = await upload({
      url: `data:${file.type};base64,${base64}`,
      messageId: slugify(file.name.substring(0, 10)),
      options: {
        width: 500, // App icon size
        height: 500,
        fit: "cover", // Crop to fit
        position: "center",
        title: file.name,
      },
    })

    console.log("✅ App image uploaded successfully:", uploadResult.url)

    // TODO: If draftId provided, update draft in database
    // if (draftId) {
    //   await db.update(appDrafts)
    //     .set({ image: uploadResult.url })
    //     .where(eq(appDrafts.id, draftId))
    // }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      draftId: draftId || undefined,
      metadata: {
        name: file.name,
        type: file.type,
        size: file.size,
        dimensions: "500x500",
      },
    })
  } catch (error: any) {
    console.error("❌ Error uploading app image:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload image" },
      { status: 500 },
    )
  }
}
