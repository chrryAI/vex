import { appWithStore } from "../types"
import { whiteLabels } from "./siteConfig"

const getWhiteLabel = ({ app }: { app?: appWithStore }) => {
  let whiteLabel = whiteLabels.find(
    (label) => label.storeSlug === app?.store?.slug && label.isStoreApp,
  )

  const storeApp = whiteLabel
    ? app?.store?.apps.find(
        (a) =>
          a.slug === whiteLabel?.slug &&
          a.store?.slug === whiteLabel?.storeSlug,
      )
    : app?.store?.apps.find((a) => a.store?.appId && a.store?.appId === app?.id)

  return { storeApp, whiteLabel }
}

export default getWhiteLabel
