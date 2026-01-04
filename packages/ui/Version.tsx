import React from "react"
import { useData, useNavigationContext, useAuth } from "./context/providers"
import Modal from "./Modal"
import {
  FaApple,
  FaAndroid,
  FaChrome,
  FaFirefox,
  FaWindows,
  FaLinux,
} from "react-icons/fa"
import Img from "./Img"
import { useTranslation } from "react-i18next"
import { Button, Div, Span, usePlatform, Video } from "./platform"
import A from "./a/A"
import { useVersionStyles } from "./Version.styles"
import { useStyles } from "./context/StylesContext"

export default function Version() {
  const {
    setNeedsUpdateModalOpen,
    versions,
    needsUpdateModalOpen,
    needsUpdate,
  } = useData()

  const { showAddToHomeScreen, setShowAddToHomeScreen } = useNavigationContext()
  const { t } = useTranslation()

  const { chromeWebStoreUrl, downloadUrl } = useAuth()

  const { os, isStandalone, isFirefox, isExtension, BrowserInstance } =
    usePlatform()

  const { FRONTEND_URL } = useData()

  const styles = useVersionStyles()
  const { utilities } = useStyles()

  return (
    <Div>
      {/* <NextTopLoader color="#197ef4" /> */}
      {needsUpdateModalOpen && versions && (
        <Modal
          isModalOpen={needsUpdateModalOpen}
          hideOnClickOutside={false}
          hasCloseButton={false}
          onToggle={(open) => {
            setNeedsUpdateModalOpen(open)
          }}
          icon={
            <Video
              style={styles.video.style}
              src={`${FRONTEND_URL}/video/blob.mp4`}
              autoPlay
              loop
              muted
              playsInline
            />
          }
          title={<Div>{t("Thinking")}...</Div>}
        >
          <Div style={styles.updateModalDescription.style}>
            <Img src={`${FRONTEND_URL}/hamster.png`} width={24} height={24} />
            <Span>
              {t("Let's update your app to the latest version")}{" "}
              {isStandalone
                ? null
                : isFirefox
                  ? versions.firefoxVersion
                  : versions.chromeVersion}
            </Span>
          </Div>
          <Div style={styles.updateModalButtons.style}>
            {os && ["ios", "android"].includes(os) ? (
              <Button
                style={{
                  ...utilities.small.style,
                }}
                onClick={() => {
                  setShowAddToHomeScreen(true)
                  setNeedsUpdateModalOpen(false)
                }}
              >
                {os === "ios" ? (
                  <FaApple
                    style={{
                      position: "relative",
                      bottom: 1,
                    }}
                    size={18}
                  />
                ) : (
                  <FaAndroid size={18} />
                )}{" "}
                {t("Install")}
              </Button>
            ) : !isFirefox ? (
              <A
                openInNewTab
                className="button"
                href={chromeWebStoreUrl}
                style={{
                  ...utilities.button.style,
                  ...utilities.small.style,
                }}
              >
                <FaChrome size={18} />
                {t("Install")}
              </A>
            ) : isFirefox ? (
              <A
                className="button"
                openInNewTab
                href="https://addons.mozilla.org/en-US/firefox/addon/vex"
                style={{
                  ...utilities.button.style,
                  ...utilities.small.style,
                }}
              >
                <FaFirefox size={18} />
                {t("Install")}
              </A>
            ) : null}

            {/* Desktop app download button */}
            {downloadUrl && (
              <A
                className="button"
                openInNewTab
                href={downloadUrl}
                style={{
                  ...utilities.button.style,
                  ...utilities.small.style,
                  marginLeft: "0.5rem",
                }}
              >
                {os === "macos" ? (
                  <FaApple size={18} />
                ) : os === "windows" ? (
                  <FaWindows size={18} />
                ) : (
                  <FaLinux size={18} />
                )}
                {t("Download Desktop")}
              </A>
            )}
          </Div>
        </Modal>
      )}
    </Div>
  )
}
