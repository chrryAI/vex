"use client"

import { useEffect, type ReactElement } from "react"
import { ShieldX } from "chrry/icons"
import styles from "./error.module.scss"
import * as Sentry from "@sentry/nextjs"
import Logo from "chrry/Logo"
import { PlatformProvider } from "chrry/context/providers"

export default function Error({
  error,
}: {
  error: Error & { digest?: string }
}): ReactElement {
  useEffect(() => {
    console.error(error)
    Sentry.captureException(error)
  }, [error])

  return (
    <PlatformProvider>
      <div className={styles.error}>
        <div className={styles.inner}>
          <a className={styles.logo} href={"/"}>
            <Logo size={32} /> Vex
          </a>

          <h1 className={styles.title}>
            <ShieldX />
            500
          </h1>
          <p>Oops! Something went wrong.</p>
        </div>
      </div>
    </PlatformProvider>
  )
}
