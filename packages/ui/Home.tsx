"use client"

import clsx from "clsx"
import { defaultLocale } from "./locales"
import Thread from "./Thread"
import { app } from "./types"
import { useAuth } from "./context/providers"
import { useApp } from "./context/providers"
import { useAppMetadata } from "./hooks"

export default function Home({
  className,
  slug,
}: {
  className?: string
  app?: app
  slug?: string
}): React.ReactElement {
  const { language, threadId } = useAuth()
  const { currentStore: store, app } = useApp()

  useAppMetadata(app, !store && !threadId)

  return (
    <div
      data-url={language === defaultLocale ? "/" : `/${language}`}
      className={clsx(className)}
    >
      <Thread isHome />
    </div>
  )
}
