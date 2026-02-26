import { updateGuest, updateUser } from "@repo/db"
import { Hono } from "hono"
import { checkSpeechLimits, type UserType } from "../../lib"
import { captureException } from "../../lib/captureException"
import { checkRateLimit } from "../../lib/rateLimiting"
import { getGuest, getMember } from "../lib/auth"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"

export const tts = new Hono()

// POST /tts - Text-to-speech conversion
tts.post("/", async (c) => {
  const member = await getMember(c, { full: true, skipCache: true })
  const guest = member ? undefined : await getGuest(c, { skipCache: true })

  if (!member && !guest) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const { success } = await checkRateLimit(c.req.raw, { member, guest })

  if (!success) {
    return c.json({ error: "Too many requests" }, 429)
  }

  try {
    const { text, voice = "alloy", language = "en" } = await c.req.json()

    // Default greeting messages by language
    const defaultGreetings = {
      en: "I'm Sushi, your personal AI assistant! How can I help you today?",
      de: "Ich bin Sushi, Ihr persönlicher KI-Assistent! Wie kann ich Ihnen heute helfen?",
      fr: "Je suis Sushi, votre assistant personnel IA ! Comment puis-je vous aider aujourd'hui ?",
      es: "¡Soy Sushi, tu asistente personal de IA! ¿Cómo puedo ayudarte hoy?",
      ja: "私はSushi、あなたのパーソナルAIアシスタントです！今日はどのようにお手伝いできますか？",
      ko: "저는 Sushi, 당신의 개인 AI 비서입니다! 오늘 어떻게 도와드릴까요?",
      pt: "Eu sou o Sushi, seu assistente pessoal de IA! Como posso ajudá-lo hoje?",
      zh: "我是Sushi，您的个人人工智能助理！今天我可以为您做些什么？",
      nl: "Ik ben Sushi, uw persoonlijke AI-assistent! Hoe kan ik u vandaag helpen?",
      tr: "Ben Sushi, kişisel yapay zeka asistanınız! Bugün size nasıl yardımcı olabilirim?",
    }

    const finalText =
      text ||
      defaultGreetings[language as keyof typeof defaultGreetings] ||
      defaultGreetings.en

    if (!finalText) {
      return c.json({ error: "Text is required" }, 400)
    }

    const textLength = finalText.length
    const userType: UserType = member?.subscribedOn
      ? "SUBSCRIBER"
      : member
        ? "USER"
        : "GUEST"

    // Get current usage stats
    const userData = member || guest
    if (!userData) {
      return c.json({ error: "User not found" }, 404)
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const lastReset = userData.lastSpeechReset
      ? new Date(userData.lastSpeechReset)
      : null
    const isNewDay = !lastReset || lastReset < today

    // Reset counters if new day
    const speechRequestsToday = isNewDay ? 0 : userData.speechRequestsToday || 0
    let speechRequestsThisHour = isNewDay
      ? 0
      : userData.speechRequestsThisHour || 0
    const speechCharactersToday = isNewDay
      ? 0
      : userData.speechCharactersToday || 0

    // Check if we need to reset hourly counter (use UTC)
    const lastResetHour = lastReset ? lastReset.getUTCHours() : -1
    const currentHour = now.getUTCHours()

    console.log(
      `🕐 UTC Current hour: ${currentHour}, Last reset hour: ${lastResetHour}`,
    )

    if (lastResetHour !== currentHour) {
      speechRequestsThisHour = 0
      console.log(
        `🔄 Hourly counter reset: ${userData.speechRequestsThisHour} → 0`,
      )
    }

    // Check limits with reset counters
    const limitCheck = checkSpeechLimits({
      user: member,
      guest,
      textLength,
    })

    if (!limitCheck.allowed) {
      return c.json(
        {
          error: limitCheck.reason,
          usage: {
            requestsToday: speechRequestsToday,
            requestsThisHour: speechRequestsThisHour,
            charactersToday: speechCharactersToday,
            userType,
          },
        },
        429,
      )
    }

    // Update usage counters
    const newRequestsToday = speechRequestsToday + 1
    const newRequestsThisHour = speechRequestsThisHour + 1
    const newCharactersToday = speechCharactersToday + textLength

    if (member) {
      updateUser({
        ...member,
        speechRequestsToday: newRequestsToday,
        speechRequestsThisHour: newRequestsThisHour,
        speechCharactersToday: newCharactersToday,
        lastSpeechReset: now,
      })
    } else if (guest) {
      updateGuest({
        ...guest,
        speechRequestsToday: newRequestsToday,
        speechRequestsThisHour: newRequestsThisHour,
        speechCharactersToday: newCharactersToday,
        lastSpeechReset: now,
      })
    }

    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: finalText,
        voice: voice,
        response_format: "mp3",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log("OpenAI TTS error response:", errorText)
      console.error(`OpenAI TTS API error: ${response.status}`)

      // Return fallback flag for client to use Web Speech API
      return c.json({
        useWebSpeech: true,
        usage: {
          requestsToday: speechRequestsToday,
          requestsThisHour: speechRequestsThisHour,
          charactersToday: speechCharactersToday,
        },
      })
    }

    const audioBuffer = await response.arrayBuffer()
    const base64Audio = Buffer.from(audioBuffer).toString("base64")

    return c.json({
      audio: `data:audio/mpeg;base64,${base64Audio}`,
      useWebSpeech: false,
      usage: {
        requestsToday: newRequestsToday,
        requestsThisHour: newRequestsThisHour,
        charactersToday: newCharactersToday,
        userType,
      },
    })
  } catch (error) {
    captureException(error)
    console.error("TTS error:", error)
    return c.json({
      useWebSpeech: true,
    })
  }
})
