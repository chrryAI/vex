import { subscription, user } from "@repo/db"
import { headers } from "next/headers"
import PDFParser from "pdf2json"
import captureException from "./captureException"
export const DEV_IP = "192.168.2.27"
export const getIp = (request: Request) => {
  const isDev = process.env.NODE_ENV !== "production"
  const ip = isDev
    ? DEV_IP
    : request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      (request.headers.get("x-forwarded-for") || "")?.split(",")?.[0]?.trim()

  return ip
}

export const extractPDFText = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve) => {
    console.log("📄 PDF buffer size:", buffer.length)

    const pdfParser = new PDFParser()

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("❌ PDF parsing error:", errData)
      resolve("[Could not extract text from PDF - parsing error]")
      captureException(errData)
    })

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        console.log("📊 PDF data received, pages:", pdfData.Pages?.length || 0)

        const text = pdfParser.getRawTextContent()
        console.log("📝 Raw text length:", text?.length || 0)
        console.log("📝 First 100 chars:", text?.substring(0, 100))

        if (text && text.trim().length > 0) {
          resolve(text)
        } else {
          // Try alternative extraction method
          let extractedText = ""
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const text of page.Texts) {
                  if (text.R) {
                    for (const run of text.R) {
                      if (run.T) {
                        extractedText += decodeURIComponent(run.T) + " "
                      }
                    }
                  }
                }
              }
              extractedText += "\n"
            }
          }

          console.log("📝 Alternative extraction result:", extractedText.length)
          resolve(extractedText || "[No text content found in PDF]")
        }
      } catch (error) {
        captureException(error)
        console.error("❌ Text extraction error:", error)
        resolve("[Could not extract text from PDF - extraction error]")
      }
    })

    try {
      pdfParser.parseBuffer(buffer)
    } catch (error) {
      captureException(error)
      console.error("❌ Buffer parsing error:", error)
      resolve("[Could not extract text from PDF - buffer error]")
    }
  })
}

export async function getDevice() {
  const headersList = await headers()

  const userAgent = headersList.get("user-agent")

  const isMobile =
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(
      userAgent || "",
    )

  return isMobile ? "mobile" : "desktop"
} // Add more device checks as needed for different devices
export async function getOS() {
  const headersList = await headers()

  let os = "unknown"
  let userAgent = headersList.get("user-agent") || ""

  if (!userAgent) {
    return os
  }

  userAgent = userAgent.toLowerCase()

  // Check iOS first (before Mac, since iPad can report as Mac)
  if (
    userAgent.indexOf("iphone") > -1 ||
    userAgent.indexOf("ipad") > -1 ||
    userAgent.indexOf("ipod") > -1
  ) {
    os = "ios"
  } else if (userAgent.indexOf("android") > -1) {
    os = "android"
  } else if (userAgent.indexOf("win") > -1) {
    os = "windows"
  } else if (userAgent.indexOf("mac") > -1) {
    os = "macos" // lowercase to match PlatformProvider
  } else if (userAgent.indexOf("x11") > -1 || userAgent.indexOf("linux") > -1) {
    os = "linux"
  }

  return os
}

export async function getBrowser() {
  const headersList = await headers()

  let browser = "unknown"
  const userAgent = headersList.get("user-agent") || ""

  if (userAgent.indexOf("Chrome") > -1) {
    browser = "chrome"
  } else if (userAgent.indexOf("Firefox") > -1) {
    browser = "firefox"
  } // Add more browser checks as needed
  else if (userAgent.indexOf("Safari") > -1) {
    browser = "safari"
  }

  return browser
}

export const getHourlyLimit = (
  member?: user & { subscription?: subscription },
) => {
  if (member?.subscription) {
    return 100
  } else if (member) {
    return 30
  } else {
    return 10
  }
}
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
export const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY
export const CHATGPT_API_KEY_2 = process.env.CHATGPT_API_KEY_2
export const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY
export const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
