import { spawn } from "child_process"
import { writeFileSync, unlinkSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { captureException } from "@sentry/nextjs"

async function extractVideoFrames(
  base64Data: string,
  mimeType: string,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tempDir = tmpdir()
    const inputPath = join(
      tempDir,
      `input_${Date.now()}.${mimeType.split("/")[1]}`,
    )
    const outputPattern = join(tempDir, `frame_${Date.now()}_%d.png`)

    try {
      // Write video data to temporary file
      const videoBuffer = Buffer.from(base64Data, "base64")
      writeFileSync(inputPath, videoBuffer)

      // Extract 5 frames using FFmpeg with reduced quality - use which command to find path
      let ffmpegPath = "ffmpeg"

      try {
        // Try to find ffmpeg using which command
        const { execSync } = require("child_process")
        const whichResult = execSync("which ffmpeg", {
          encoding: "utf8",
        }).trim()
        if (whichResult) {
          ffmpegPath = whichResult
        }
      } catch (error) {
        // Fallback to checking common paths
        const commonPaths = ["/usr/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"]
        ffmpegPath = commonPaths.find((path) => existsSync(path)) || "ffmpeg"
      }

      console.log(`🎥 Using FFmpeg path: ${ffmpegPath}`)

      const ffmpeg = spawn(ffmpegPath, [
        "-i",
        inputPath,
        "-vf",
        "fps=1/3,scale=512:512:force_original_aspect_ratio=decrease", // Extract 1 frame every 3 seconds, resize to 512x512
        "-frames:v",
        "5",
        "-q:v",
        "8", // Lower quality (higher number = lower quality)
        outputPattern,
        "-y", // Overwrite output files
      ])

      let stderr = ""
      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      ffmpeg.on("close", (code) => {
        // Clean up input file
        if (existsSync(inputPath)) {
          unlinkSync(inputPath)
        }

        if (code !== 0) {
          captureException(new Error(`FFmpeg failed with code ${code}`))
          console.error("FFmpeg error:", stderr)
          reject(new Error(`FFmpeg failed with code ${code}`))
          return
        }

        // Read extracted frames
        const frames: string[] = []
        for (let i = 1; i <= 5; i++) {
          const framePath = outputPattern.replace("%d", i.toString())
          if (existsSync(framePath)) {
            const frameBuffer = require("fs").readFileSync(framePath)
            frames.push(frameBuffer.toString("base64"))
            unlinkSync(framePath) // Clean up frame file
          }
        }

        resolve(frames)
      })

      ffmpeg.on("error", (error) => {
        captureException(error)
        // Clean up input file on error
        if (existsSync(inputPath)) {
          unlinkSync(inputPath)
        }
        reject(error)
      })
    } catch (error) {
      captureException(error)
      // Clean up input file on error
      if (existsSync(inputPath)) {
        unlinkSync(inputPath)
      }
      reject(error)
    }
  })
}

export default extractVideoFrames
