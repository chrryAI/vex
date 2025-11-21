"use client"

import React from "react"
import Skeleton from "./Skeleton"
import styles from "./Focus.module.scss"
import FocusButton from "./FocusButton"

export default function Focus({ children }: { children?: React.ReactNode }) {
  return (
    <Skeleton className={styles.page}>
      <FocusButton />
      {children}
    </Skeleton>
  )
}
