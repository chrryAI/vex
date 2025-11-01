"use server"

import slugify from "slug"
import { upload } from "../../lib/uploadthing-server"
import { processFileForRAG } from "./ragService"
import getMember from "./getMember"
import getGuest from "./getGuest"
import {
  getMessages,
  thread,
  updateMessage,
  updateThread,
  createMessage,
} from "@repo/db"
import { extractPDFText } from "../../lib"
import { v4 as uuidv4 } from "uuid"
import { isE2E } from "chrry/utils"
import captureException from "../../lib/captureException"

export const uploadArtifacts = async ({
  files,
  thread,
}: {
  files: File[]
  thread: thread
}) => {
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    throw new Error("User or guest not found")
  }

  let firstMessage = (await getMessages({ threadId: thread.id, isAsc: true }))
    ?.messages?.[0]?.message

  // Create a placeholder message if none exists to satisfy foreign key constraint
  if (!firstMessage) {
    const placeholderMessage = await createMessage({
      content: "[Artifacts uploaded to thread]",
      threadId: thread.id,
      userId: member?.id,
      guestId: guest?.id,
    })
    firstMessage = placeholderMessage
  }

  const messageIdForRAG = firstMessage!.id

  const uploadedFiles = [...(thread.artifacts || [])] // Start with existing artifacts

  // Process all incoming files (they're all new uploads)
  const fileContents = await Promise.all(
    files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      const mimeType = file.type

      console.log(
        `✅ Processing new file ${file.name} (${mimeType}, ${(file.size / 1024).toFixed(1)}KB)`,
      )

      return {
        type: mimeType.startsWith("image/")
          ? "image"
          : mimeType.startsWith("audio/")
            ? "audio"
            : mimeType.startsWith("video/")
              ? "video"
              : mimeType.startsWith("application/pdf")
                ? "pdf"
                : mimeType.startsWith("text/")
                  ? "text"
                  : "file",
        mimeType,
        data: base64,
        filename: file.name,
        size: file.size,
      }
    }),
  )
  // Add file parts - only process new files
  if (fileContents && fileContents.length > 0) {
    for (const file of fileContents) {
      if (file.type === "text") {
        const textContent =
          file.type === "text"
            ? Buffer.from(file.data, "base64").toString("utf8")
            : undefined

        // Process text file for RAG instead of appending entire content
        if (textContent) {
          const uploadResult = await upload({
            url: `data:${file.mimeType};base64,${file.data}`,
            messageId: slugify(file.filename.substring(0, 10)),
            options: {
              title: file.filename,
              type: "text",
            },
          })
          !isE2E &&
            (await processFileForRAG({
              content: textContent,
              filename: file.filename,
              fileType: "text",
              fileSizeBytes: file.size,
              messageId: messageIdForRAG,
              threadId: thread.id,
              userId: member?.id,
              guestId: guest?.id,
            }))

          uploadedFiles.push({
            data: textContent,
            name: file.filename,
            size: file.size,
            type: file.type,
            url: uploadResult.url,
            id: uuidv4(),
          })
        }
      } else if (file.type === "pdf" || file.type === "application/pdf") {
        const uploadResult = await upload({
          url: `data:${file.mimeType};base64,${file.data}`,
          messageId: slugify(file.filename.substring(0, 10)),
          options: {
            title: file.filename,
            type: "pdf",
          },
        })

        try {
          const pdfBuffer = Buffer.from(file.data, "base64")
          const extractedText = await extractPDFText(pdfBuffer)

          uploadedFiles.push({
            data: extractedText,
            url: uploadResult.url,
            name: file.filename,
            size: file.size,
            type: "pdf",
            id: uuidv4(),
          })
          !isE2E &&
            (await processFileForRAG({
              content: extractedText,
              filename: file.filename,
              fileType: "pdf",
              fileSizeBytes: file.size,
              messageId: messageIdForRAG,
              threadId: thread.id,
              userId: member?.id,
              guestId: guest?.id,
            }))
        } catch (error) {
          captureException(error)
          console.error("PDF extraction failed:", error)
        }
      }
    }
  }

  // Update thread artifacts - append new files to existing ones
  const t = await updateThread({
    ...thread,
    artifacts: uploadedFiles,
  })
}
