"use client"
import { LoaderCircle } from "./icons"
import { useHasHydrated } from "./hooks"
import { useLoadingStyles } from "./Loading.styles"
import { Div } from "./platform"

export default function Loading({
  className,
  width,
  height,
  size,
  color = "var(--accent-6)",
  fullScreen = false,
}: {
  className?: string
  width?: number
  height?: number
  color?: string
  size?: number
  fullScreen?: boolean
}): React.ReactElement | null {
  const isHydrated = useHasHydrated()

  const styles = useLoadingStyles()
  const LoadingWrapper = ({ children }: { children: React.ReactNode }) =>
    fullScreen ? (
      <Div className={"fullScreen"} style={styles.loadingWrapper.style}>
        {children}
      </Div>
    ) : (
      <>{children}</>
    )

  if (!isHydrated) {
    return null
  }
  return (
    <LoadingWrapper>
      <LoaderCircle
        width={width || size || 24}
        height={height || size || 24}
        style={styles.loadingCircle.style}
        color={color as any}
        data-testid="imgLoading"
        className="spinner"
      />
    </LoadingWrapper>
  )
}
