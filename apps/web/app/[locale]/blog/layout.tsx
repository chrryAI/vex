"use client"
import React from "react"
import styles from "./layout.module.scss"
import Skeleton from "chrry/Skeleton"

export default function Layout({ children }: LayoutProps<"/[locale]/blog">) {
  return (
    <Skeleton>
      <div className={styles.blogLayout}>{children}</div>
    </Skeleton>
  )
}
