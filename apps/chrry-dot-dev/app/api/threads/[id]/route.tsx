import {
  canCollaborate,
  createCollaboration,
  deleteThread,
  getCharacterProfile,
  getInvitation,
  getMessages,
  getTask,
  getThread,
  getUser,
  updateCharacterProfile,
  updateInvitation,
  updateTask,
  updateThread,
} from "@repo/db"
import { getSiteConfig } from "chrry/utils/siteConfig"
import { after, NextRequest, NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import getGuest from "../../../actions/getGuest"
import { uploadArtifacts } from "../../../actions/uploadArtifacts"
import { checkGenerationRateLimit } from "../../../../lib/rateLimiting"

import nodemailer from "nodemailer"
import { render } from "@react-email/render"

import { validate } from "uuid"
import { PROMPT_LIMITS } from "@repo/db/src/schema"
import {
  generateThreadInstructions,
  generateThreadTitle,
} from "../../../../utils/titleGenerator"
import { FRONTEND_URL, isE2E, isOwner, MAX_FILE_LIMITS } from "chrry/utils"
import Collaboration from "../../../../components/emails/Collaboration"
import { defaultLocale } from "chrry/locales"
import captureException from "../../../../lib/captureException"
import { scanFileForMalware } from "../../../../lib/security"
import { deleteFile } from "../../../../lib/minio"

export async function GET(request: Request) {
  const id = request.url.split("/").pop()?.split("?")[0] || ""

  const liked = request.url.includes("liked")

  if (!validate(id)) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const pageSize = Number(searchParams.get("pageSize") || "100")

  if (!id) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const thread = await getThread({ id })

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  if (
    !canCollaborate({
      thread,
      userId: member?.id,
      guestId: guest?.id,
    })
  ) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  const messages = await getMessages({
    threadId: id,
    pageSize,
    likedBy: liked ? member?.id || guest?.id : undefined,
  })

  return NextResponse.json({ thread, messages })
}

export async function DELETE(request: Request) {
  const id = request.url.split("/").pop()?.split("?")[0]

  if (!id) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  if (!validate(id)) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  const thread = await getThread({
    id: id!,
    userId: member?.id,
    guestId: guest?.id,
  })

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const messages = await getMessages({
    threadId: id,
    pageSize: 100000,
    hasAttachments: true,
  })

  await Promise.all(
    messages.messages.map((message) => {
      if (message.message.files) {
        message.message.files.forEach((file) => {
          if (file.url) {
            deleteFile(file.url)
          }
        })

        if (message.message.images) {
          message.message.images.forEach((image) => {
            if (image.url) {
              deleteFile(image.url)
            }
          })
        }

        if (message.message.video) {
          message.message.video.forEach((video) => {
            if (video.url) {
              deleteFile(video.url)
            }
          })
        }

        if (message.message.audio) {
          message.message.audio.forEach((audio) => {
            if (audio.url) {
              deleteFile(audio.url)
            }
          })
        }
      }
    }),
  )

  await deleteThread({ id: id! })

  return NextResponse.json({ thread })
}

export async function PATCH(request: NextRequest) {
  const id = request.url.split("/").pop()?.split("?")[0]

  // Check if request contains files (multipart/form-data) or JSON
  const contentType = request.headers.get("content-type") || ""
  let requestData: any
  let files: File[] = []

  if (contentType.includes("multipart/form-data")) {
    // Handle file uploads
    const formData = (await request.formData()) as unknown as FormData
    const rawAppId = formData.get("appId")

    requestData = {
      language: formData.get("language") as string,
      regenerateTitle: formData.get("regenerateTitle") === "true",
      instructions: formData.get("instructions") as string,
      title: formData.get("title") as string,
      regenerateInstructions: formData.get("regenerateInstructions") === "true",
      visibility: formData.get("visibility") as string,
      bookmarked: formData.get("bookmarked") === "true",
      pinCharacterProfile: formData.get("pinCharacterProfile"),
      appId: rawAppId && validate(rawAppId as string) ? rawAppId : null,
    }

    // Extract files from form data
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && key.startsWith("artifact_")) {
        files.push(value)
      }
    }
  } else {
    // Handle JSON requests (no files)
    requestData = await request.json()
  }

  if (files.length > MAX_FILE_LIMITS.artifacts) {
    return new Response(
      JSON.stringify({
        error: `Maximum ${MAX_FILE_LIMITS.artifacts} files allowed`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  // Scan files for malware
  console.log("🔍 Scanning files for malware...")
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const scanResult = await scanFileForMalware(buffer)

    if (!scanResult.safe) {
      console.error(`🚨 Malware detected in ${file.name}: ${scanResult.threat}`)
      return NextResponse.json(
        {
          error: `File '${file.name}' failed security scan${scanResult.threat ? `: ${scanResult.threat}` : ""}`,
        },
        { status: 400 },
      )
    }
  }
  console.log("✅ All files passed malware scan")

  const star = Number(requestData.star) || null
  const bookmarked = requestData.bookmarked ?? undefined
  const instructions = requestData.instructions
  const language = requestData.language || "en"
  const title = requestData.title
  const visibility = requestData.visibility
  const regenerateTitle = requestData.regenerateTitle === true
  const regenerateInstructions = requestData.regenerateInstructions === true
  const pinCharacterProfile = requestData.pinCharacterProfile
  const characterProfileVisibility = requestData.characterProfileVisibility
  const appId =
    requestData.appId && validate(requestData.appId as string)
      ? requestData.appId
      : null

  if (instructions && instructions.length > PROMPT_LIMITS.INSTRUCTIONS) {
    return NextResponse.json(
      { error: "Instructions too long" },
      { status: 400 },
    )
  }
  if (!id) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  if (!validate(id)) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const member = await getMember()
  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 },
    )
  }

  const thread = await getThread({
    id,
  })

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found", status: 404 },
      { status: 404 },
    )
  }

  const task = thread?.taskId
    ? await getTask({
        id: thread.taskId,
      })
    : undefined

  const invitation = member?.email
    ? await getInvitation({
        email: member.email,
        threadId: id,
      })
    : undefined

  if (member && invitation && invitation.status === "pending") {
    await createCollaboration({
      threadId: id,
      userId: member?.id,
      role: "collaborator",
      status: "active",
    })

    await updateInvitation({
      ...invitation,
      status: "accepted",
    })

    const siteConfig = getSiteConfig()

    after(async () => {
      const inviter = invitation.userId
        ? await getUser({
            id: invitation.userId,
          })
        : undefined

      if (inviter && inviter.email && !isE2E) {
        const transporter = nodemailer.createTransport({
          host: "smtp.zeptomail.eu",
          port: 587,
          auth: {
            user: "emailapikey",
            pass: process.env.ZEPTOMAIL_API_KEY!,
          },
        })

        const emailHtml = await render(
          <Collaboration
            origin={FRONTEND_URL}
            thread={thread}
            user={member}
            language={member.language || defaultLocale}
          />,
        )

        try {
          // ZeptoMail returns void on success, throws on error
          await transporter.sendMail({
            from: `"${siteConfig.name} Team" <no-reply@${siteConfig.domain}>`,
            to: inviter.email,
            subject: `Let's get started with ${siteConfig.name}!`,
            html: emailHtml,
            headers: {
              "List-Unsubscribe": `<mailto:unsubscribe@${siteConfig.domain}>`,
              "X-Mailer": `${siteConfig.name} Collaboration System`,
            },
          })
        } catch (error) {
          captureException(error)
          console.error("ZeptoMail API error:", error)
          return NextResponse.json(
            { error: "Failed to send invite" },
            { status: 500 },
          )
        }
      }
    })
  }

  const owner = isOwner(thread, {
    userId: member?.id,
    guestId: guest?.id,
  })

  if (
    (owner && pinCharacterProfile === true) ||
    pinCharacterProfile === false
  ) {
    const characterProfile = await getCharacterProfile({
      threadId: id,
    })

    if (characterProfile) {
      await updateCharacterProfile({
        ...characterProfile,
        pinned: pinCharacterProfile,
        visibility: !pinCharacterProfile
          ? "private"
          : characterProfileVisibility,
      })
    }

    return NextResponse.json({
      thread: await getThread({
        id,
      }),
      pinCharacterProfile,
      characterProfileVisibility,
    })
  }

  const newBookmarks =
    bookmarked === undefined
      ? thread.bookmarks
      : bookmarked
        ? thread.bookmarks?.some(
            (b) =>
              b.userId === member?.id || (guest && b.guestId === guest?.id),
          )
          ? thread.bookmarks
          : [
              ...(thread.bookmarks?.filter(
                (b) => b.userId !== member?.id && b.guestId !== guest?.id,
              ) || []),
              {
                userId: member?.id,
                guestId: guest?.id,
                createdOn: new Date().toISOString(),
              },
            ]
        : thread.bookmarks?.filter(
            (b) => b.userId !== member?.id && b.guestId !== guest?.id,
          ) || []

  if (!owner) {
    if (bookmarked !== undefined) {
      await updateThread({
        ...thread,
        bookmarks: newBookmarks,
      })
    } else {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 },
      )
    }
  }

  const messages =
    regenerateTitle || regenerateInstructions
      ? await getMessages({ threadId: id, page: 1, pageSize: 30 })
      : undefined

  if (regenerateTitle && messages && messages.messages.length > 0) {
    // Check rate limit for title generation
    const rateLimitResult = await checkGenerationRateLimit(request, {
      member,
      guest,
      threadId: id!,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.errorMessage },
        { status: 429 },
      )
    }

    const newTitle = await generateThreadTitle({
      messages: messages.messages.map((m) => m.message.content),
      instructions,
      language,
      threadId: id,
    })

    if (task) {
      await updateTask({
        ...task,
        title: newTitle,
      })
    }

    return NextResponse.json({
      thread: {
        ...thread,
        title: newTitle,
      },
      titleGenerationsRemaining: rateLimitResult.remaining,
    })
  }

  if (regenerateInstructions && messages && messages.messages.length > 0) {
    // Check rate limit for instruction generation
    const rateLimitResult = await checkGenerationRateLimit(request, {
      member,
      guest,
      threadId: id!,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.errorMessage },
        { status: 429 },
      )
    }

    return NextResponse.json({
      thread: {
        ...thread,
        instructions: await generateThreadInstructions({
          messages: messages.messages.map((m) => m.message.content),
          currentInstructions: instructions,
          language,
          threadId: id!,
        }),
      },
      titleGenerationsRemaining: rateLimitResult.remaining,
    })
  }

  if (task) {
    await updateTask({
      ...task,
      title: title || thread.title,
    })
  }

  await updateThread({
    ...thread,
    appId: appId ?? thread.appId,
    star: star === 0 ? null : star,
    title: title || thread.title,
    visibility: visibility || thread.visibility,
    bookmarks: newBookmarks,
    instructions:
      instructions === "" ? null : instructions || thread.instructions,
  })

  // Process uploaded artifacts if any
  if (files && files.length > 0) {
    const updatedThread = await getThread({ id })
    if (updatedThread) {
      await uploadArtifacts({
        files,
        thread: updatedThread,
      })
    }
  }

  return NextResponse.json({
    thread: await getThread({
      id,
    }),
  })
}
