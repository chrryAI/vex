"use client"

import type { ReactElement, ReactNode } from "react"
import Skeleton from "chrry/Skeleton"

export default function SkeletonComponent({
  className,
  children,
  showThreads = true,
}: {
  className?: string
  children?: ReactNode
  showThreads?: boolean
}): ReactElement {
  return (
    <Skeleton
      className={className}
      showThreads={showThreads}
      children={children}
    />
  )
}
