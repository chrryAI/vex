"use client"

import type React from "react"
import { useEffect } from "react"
import { CircleFlag } from "react-circle-flags"
import { COLORS } from "./context/AppContext"
import { useApp } from "./context/providers"
import Img from "./Img"
import { Claude, DeepSeek, Flux, Gemini, OpenAI, Perplexity } from "./icons"
import { getImageSrc } from "./lib"
import { Text } from "./platform"
import type { appWithStore, store } from "./types"
import {
  API_URL,
  FRONTEND_URL,
  isDevelopment,
  PROD_FRONTEND_URL,
} from "./utils"

type ImageProps = {
  slug?: "atlas" | "peach" | "vault" | "bloom" | string

  className?: string
  size?: number
  title?: string
  showLoading?: boolean
  dataTestId?: string
  src?: string
  logo?:
    | "lifeOS"
    | "isMagenta"
    | "isVivid"
    | "vex"
    | "chrry"
    | "blossom"
    | "focus"
    | "architect"
    | "sushi"
    | "coder"
    | "grape"
    | "pear"
    | "watermelon"
    | "avocado"
    | "donut"

  icon?:
    | "spaceInvader"
    | "pacman"
    | "heart"
    | "plus"
    | "hamster"
    | "frog"
    | "calendar"
    | "deepSeek"
    | "perplexity"
    | "claude"
    | "chatGPT"
    | "gemini"
    | "flux"
    | "chrry"
    | "raspberry"
    | "strawberry"
    | "sushi"
    | "zarathustra"
    | "molt"

  app?: appWithStore
  width?: number | string
  height?: number | string
  style?: React.CSSProperties
  alt?: string
  containerClass?: string
  onLoad?: (src?: string) => void
  store?: store
  PROD_FRONTEND_URL?: string
  FRONTEND_URL?: string
  BASE_URL?: string
  canEditApp?: boolean
  image?: string
  priority?: boolean
}

export default function ImageComponent(props: ImageProps) {
  const {
    className,
    showLoading,
    logo,
    title,
    alt,
    slug,
    app,
    style,
    containerClass,
    dataTestId,
    onLoad,
    icon,
    priority,
  } = props

  const BASE_URL = FRONTEND_URL

  const { appFormWatcher, canEditApp } = useApp()

  const { src, width, height, size } = getImageSrc({
    ...props,
    canEditApp,
    image: appFormWatcher?.image,
    BASE_URL,
    PROD_FRONTEND_URL,
    slug,
  })

  const agents = [
    "deepSeek",
    "chatGPT",
    "claude",
    "gemini",
    "flux",
    "perplexity",
  ]
  const isAgent =
    (slug && agents.includes(slug)) ||
    (app?.onlyAgent &&
      app?.defaultModel &&
      app?.slug !== "search" &&
      agents.includes(app?.defaultModel))

  const isEmoji =
    !src &&
    app?.slug &&
    (app?.store?.slug === "movies" ||
      app?.store?.slug === "books" ||
      app?.store?.slug === "compass")

  useEffect(() => {
    if (isEmoji || isAgent) {
      onLoad?.()
    }
  }, [isEmoji, isAgent])

  const resize = ({
    url,
    width,
    height,
  }: {
    url: string
    width?: number | string
    height?: number | string
  }) => {
    if (isDevelopment) {
      return url
    }
    if (typeof width === "string") {
      return url
    }
    if (typeof height === "string") {
      return url
    }

    // Skip resize for blob URLs, data URLs, and external URLs
    const isBlob = url.startsWith("blob:")
    const isDataUrl = url.startsWith("data:")
    const isExternal =
      url.startsWith("http") &&
      !url.startsWith(FRONTEND_URL) &&
      !url.startsWith(PROD_FRONTEND_URL) &&
      !url.includes("minio.chrry.dev") // Allow MinIO URLs

    if (isBlob || isDataUrl || isExternal) {
      return url
    }

    // Request 3x size for Super Retina displays to match "original" crispness
    // e.g. If rendering at 48px, request 144px image
    // Force PNG format to avoid any WebP compression artifacts
    const density = 3
    const targetWidth = typeof width === "number" ? width * density : width
    const targetHeight = typeof height === "number" ? height * density : height

    // Resize all images, not just FRONTEND_URL ones
    // MinIO images need resizing too!
    return `${API_URL}/resize?url=${encodeURIComponent(url)}&w=${targetWidth}&h=${targetHeight}&fit=contain&q=100&fmt=png`
  }

  const color =
    COLORS[app?.themeColor as keyof typeof COLORS] || "var(--accent-6)"

  // Convert size to number, fallback to 24 if it's a CSS string like "100%"
  const isNumericString = (val: string) => /^\d+$/.test(val)
  const intSize =
    typeof size === "number"
      ? size
      : typeof size === "string" && isNumericString(size)
        ? Number.parseInt(size, 10)
        : 24 // Default size for emojis when size is CSS unit

  const emojiSize = intSize <= 50 ? intSize * 0.85 : intSize

  if (icon === "molt") {
    return <Text style={{ fontSize: emojiSize }}>🦞</Text>
  }
  // if (isEmoji) {
  if (app?.store?.slug === "books") {
    if (app.slug === "1984") {
      return <Text style={{ fontSize: emojiSize }}>👁️</Text>
    }

    if (app.slug === "meditations") {
      return <Text style={{ fontSize: emojiSize }}>🏛️</Text>
    }

    if (app.slug === "dune") {
      return <Text style={{ fontSize: emojiSize }}>🏜️</Text>
    }
  }

  const appSlug = app?.slug || slug

  if (appSlug === "fightClub") {
    return <Text style={{ fontSize: emojiSize }}>🧼</Text>
  }

  if (appSlug === "inception") {
    return <Text style={{ fontSize: emojiSize }}>🌀</Text>
  }

  if (appSlug === "pulpFiction") {
    return <Text style={{ fontSize: emojiSize }}>🍔</Text>
  }

  if (appSlug === "hungerGames") {
    return <Text style={{ fontSize: emojiSize }}>🏹</Text>
  }

  if (appSlug === "amsterdam") {
    return <CircleFlag height={emojiSize} countryCode="nl" />
  }

  if (appSlug === "tokyo") {
    return <CircleFlag height={emojiSize} countryCode="jp" />
  }

  if (appSlug === "paris") {
    return <CircleFlag height={emojiSize} countryCode="fr" />
  }

  if (appSlug === "istanbul") {
    return <CircleFlag height={emojiSize} countryCode="tr" />
  }

  if (appSlug === "newYork") {
    return <CircleFlag height={emojiSize} countryCode="us" />
  }
  // }

  if (isAgent && app) {
    return app.defaultModel === "deepSeek" ? (
      <DeepSeek color={color} size={size} />
    ) : app.defaultModel === "chatGPT" ? (
      <OpenAI color={color} size={size} />
    ) : app.defaultModel === "claude" ? (
      <Claude color={color} size={size} />
    ) : app.defaultModel === "gemini" ? (
      <Gemini color={color} size={size} />
    ) : app.defaultModel === "flux" ? (
      <Flux color={color} size={size} />
    ) : app.defaultModel === "perplexity" ? (
      <Perplexity color={color} size={size} />
    ) : null
  }

  if (isAgent && slug) {
    return slug === "deepSeek" ? (
      <DeepSeek color={color} size={size} />
    ) : slug === "chatGPT" ? (
      <OpenAI color={color} size={size} />
    ) : slug === "claude" ? (
      <Claude color={color} size={size} />
    ) : slug === "gemini" ? (
      <Gemini color={color} size={size} />
    ) : slug === "flux" ? (
      <Flux color={color} size={size} />
    ) : slug === "perplexity" ? (
      <Perplexity color={color} size={size} />
    ) : null
  }
  const invader = `${BASE_URL}/images/pacman/space-invader.png`

  return (
    <>
      <Img
        key={src}
        onLoad={onLoad}
        dataTestId={dataTestId}
        containerClass={containerClass}
        style={style}
        className={className}
        showLoading={showLoading}
        width={width}
        height={height}
        title={title}
        priority={priority}
        src={resize({
          url: slug && !src ? invader : src || invader,
          width,
          height,
        })}
        alt={alt || app?.title || logo ? "Vex" : ""}
      />
    </>
  )
}
