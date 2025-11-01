"use client"

import Skeleton from "chrry/Skeleton"

export default function SkeletonComponent({
  className,
  children,
  showThreads = true,
}: {
  className?: string
  children?: React.ReactNode
  showThreads?: boolean
}) {
  return (
    <Skeleton
      className={className}
      showThreads={showThreads}
      children={children}
    />
  )
}
