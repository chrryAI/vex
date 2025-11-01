import slugify from "slug"
import { deleteFile, upload } from "../../../../lib/uploadthing-server"
import getMember from "../../../actions/getMember"
import { NextRequest, NextResponse } from "next/server"
import { updateUser } from "@repo/db"
import { scanFileForMalware } from "../../../../lib/security"

export async function PATCH(request: NextRequest) {
  const member = await getMember()

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = (await request.formData()) as unknown as FormData

  const { image } = Object.fromEntries(formData.entries()) as { image: File }

  if (member.image) {
    await deleteFile(member.image)
  }

  if (!image) {
    await updateUser({ ...member, image: null })

    return NextResponse.json({ url: null })
  }

  try {
    const arrayBuffer = await image.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const scanResult = await scanFileForMalware(buffer)

    if (!scanResult.safe) {
      console.error(`🚨 Malware detected`)
      return NextResponse.json(
        {
          error: `File failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        { status: 400 },
      )
    }

    const base64 = buffer.toString("base64")

    const uploadResult = await upload({
      url: `data:${image.type};base64,${base64}`,
      messageId: slugify(image.name.substring(0, 10)),
      options: {
        width: 200, // Changed from maxWidth to width for exact sizing
        height: 200, // Changed from maxHeight to height for exact sizing
        fit: "cover", // This will crop the image to fit the dimensions
        position: "top",
        title: image.name,
      },
    })

    await updateUser({ ...member, image: uploadResult.url })

    return NextResponse.json({ url: uploadResult.url })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    )
  }
}
