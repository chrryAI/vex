"use client"
import { app, appWithStore, store } from "./types"
import { PROD_FRONTEND_URL, FRONTEND_URL } from "chrry/utils"

import React, { useEffect } from "react"
import Img from "./Img"
import { COLORS, useAppContext } from "./context/AppContext"
import { usePlatform } from "./platform"
import { useApp, useData } from "./context/providers"
import {
  DeepSeek,
  OpenAI,
  Claude,
  Gemini,
  Flux,
  Perplexity,
} from "@lobehub/icons"
import { getImageSrc } from "./lib"
import { Clapperboard, Hand, Shell } from "./icons"

type ImageProps = {
  slug?: "atlas" | "peach" | "vault" | "bloom"

  className?: string
  size?: number
  title?: string
  showLoading?: boolean
  dataTestId?: string
  src?: string
  logo?: "lifeOS" | "isMagenta" | "isVivid" | "vex" | "chrry"
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

  app?: appWithStore
  width?: number | string
  height?: number | string
  style?: React.CSSProperties
  alt?: string
  containerClass?: string
  onLoad?: () => void
  store?: store
  PROD_FRONTEND_URL?: string
  FRONTEND_URL?: string
  BASE_URL?: string
  canEditApp?: boolean
  image?: string
}

export default function ImageComponent(props: ImageProps) {
  const {
    className,
    showLoading,
    slug,
    logo,
    app,
    store,
    title,
    alt,
    icon,
    style,
    containerClass,
    dataTestId,
    onLoad,
  } = props

  const { isExtension } = usePlatform()

  const BASE_URL = FRONTEND_URL

  const { appFormWatcher, canEditApp } = useApp()

  const { src, width, height, size } = getImageSrc({
    ...props,
    canEditApp,
    image: appFormWatcher?.image,
    BASE_URL,
    PROD_FRONTEND_URL,
  })

  useEffect(() => {
    setTimeout(() => {
      onLoad?.()
    }, 500)
  }, [app?.onlyAgent && !app.image])

  const color =
    COLORS[app?.themeColor as keyof typeof COLORS] || "var(--accent-6)"

  if (!app?.image && app?.slug) {
    if (app?.store?.slug === "movies" && app.slug !== "popcorn") {
      if (app.slug === "fightClub") {
        return <span style={{ fontSize: size }}>🧼</span>
      }

      if (app.slug === "inception") {
        return <span style={{ fontSize: size }}>🌀</span>
      }

      if (app.slug === "pulpFiction") {
        return <span style={{ fontSize: size }}>🍔</span>
      }

      if (app.slug === "hungerGames") {
        return <span style={{ fontSize: size }}>🏹</span>
      }

      return <Clapperboard color={color} size={size} />
    }

    if (app.slug === "amsterdam") {
      return <span style={{ fontSize: size }}>🇳🇱</span>
    }

    if (app.slug === "tokyo") {
      return <span style={{ fontSize: size }}>🇯🇵</span>
    }

    if (app.slug === "paris") {
      return <span style={{ fontSize: size }}>🇫🇷</span>
    }

    if (app.slug === "istanbul") {
      return <span style={{ fontSize: size }}>🇹🇷</span>
    }

    if (app.slug === "newYork") {
      return <span style={{ fontSize: size }}>🗽</span>
    }

    if (app.slug === "zarathustra") {
      return <span style={{ fontSize: size }}>📕</span>
    }

    if (app.slug === "1984") {
      return <span style={{ fontSize: size }}>👁️</span>
    }

    if (app.slug === "meditations") {
      return <span style={{ fontSize: size }}>🏛️</span>
    }

    if (app.slug === "dune") {
      return <span style={{ fontSize: size }}>🏜️</span>
    }
  }
  if (app?.onlyAgent && !app.image) {
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

  return (
    <Img
      onLoad={onLoad}
      dataTestId={dataTestId}
      containerClass={containerClass}
      style={style}
      className={className}
      showLoading={showLoading}
      width={width}
      height={height}
      title={title}
      src={src}
      alt={alt || app?.title || logo ? "Vex" : ""}
    />
  )
}
