import React, { useEffect, type CSSProperties } from "react"
import { Span, Button } from "./platform"
import { appWithStore } from "./types"
import { useAuth, useChat } from "./context/providers"
import A from "./a/A"
import { useStyles } from "./context/StylesContext"
import Loading from "./Loading"

export default function AppLink({
  style,
  app,
  children,
  onLoading,
  loading,
  className,
  as = "a",
  loadingStyle,
  icon,
  ...props
}: {
  style?: CSSProperties
  app: appWithStore
  children?: React.ReactNode
  as?: "a" | "button"
  onLoading?: () => void
  loading?: React.ReactNode
  className?: string
  loadingStyle?: CSSProperties
  icon?: string
  setIsNewAppChat?: (item: appWithStore) => void
}) {
  const { setIsWebSearchEnabled, setIsNewAppChat } = useChat()
  const { loadingApp, getAppSlug, hasStoreApps, setLoadingApp, storeApps } =
    useAuth()

  const [isLoading, setIsLoading] = React.useState(
    loadingApp && loadingApp?.id === app?.id,
  )

  React.useEffect(() => {
    setIsLoading(loadingApp && loadingApp?.id === app?.id)
  }, [loadingApp])

  useEffect(() => {
    const a = storeApps.find((app) => app.id === loadingApp?.id)
    if (hasStoreApps(a) && a) {
      setLoadingApp(undefined)
      props.setIsNewAppChat?.(a)
    }
  }, [loadingApp, storeApps])

  const { utilities } = useStyles()
  if (as === "a") {
    return (
      <A
        style={{
          ...style,
          ...(isLoading ? loadingStyle : {}),
        }}
        onClick={() => {
          if (!hasStoreApps(app)) {
            setLoadingApp(app)
            onLoading?.()
            return
          }

          if (props.setIsNewAppChat) {
            return props.setIsNewAppChat(app)
          }
          setIsNewAppChat({ item: app })
        }}
        className={`${className}`}
      >
        {isLoading ? (
          <Span>{loading || <Loading />}</Span>
        ) : (
          <Span>{icon}</Span>
        )}
        <Span>{children}</Span>
      </A>
    )
  }

  return (
    <Button
      style={{ ...style, ...(isLoading ? loadingStyle : {}) }}
      onClick={() => {
        if (isLoading) {
          onLoading?.()
          return
        }
        setIsNewAppChat({ item: app })
      }}
      className={className}
    >
      {isLoading ? <Span>{loading || <Loading />}</Span> : <Span>{icon}</Span>}

      <Span>{children}</Span>
    </Button>
  )
}
