"use client"

import type { ReactElement } from "react"
import { ArrowLeft, ShieldX } from "chrry/icons"
import styles from "./not-found.module.scss"
import Logo from "chrry/Logo"
import Img from "chrry/Img"
import { FRONTEND_URL } from "chrry/utils"
import { PlatformProvider } from "chrry/context/providers"

export default function NotFound(): ReactElement {
  return (
    <PlatformProvider>
      <div className={styles.notFound}>
        <div className={styles.inner}>
          <a className={styles.logo} href={"/"}>
            <Logo size={32} /> Vex
          </a>

          <h1 className={styles.title}>
            <Img
              src={`${FRONTEND_URL}/hamster.png`}
              showLoading={false}
              width={26}
              height={26}
            />
            404
          </h1>
          <p>Oops! This page was not found.</p>
        </div>
      </div>
    </PlatformProvider>
  )
}
