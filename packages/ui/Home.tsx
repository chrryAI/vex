"use client"

import { useApp, useAuth } from "./context/providers"
import { useAppMetadata } from "./hooks"
import { Div } from "./platform"
import Thread from "./Thread"
import type { app } from "./types"

export default function Home({
  className,
  slug,
  style,
}: {
  className?: string
  style?: React.CSSProperties
  app?: app
  slug?: string
}): React.ReactElement {
  const { language, threadId, threadIdRef } = useAuth()
  const { currentStore: store, app } = useApp()

  useAppMetadata()

  return (
    <Div className={className} style={style}>
      <Thread isHome={!threadId && !threadIdRef.current} />
    </Div>
  )
}
