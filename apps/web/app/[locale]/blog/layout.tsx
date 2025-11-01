"use client"
import React from "react"
import styles from "./layout.module.scss"
import Skeleton from "chrry/Skeleton"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Skeleton>
      <div className={styles.blogLayout}>{children}</div>
    </Skeleton>
  )
}
