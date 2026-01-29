import { locales } from "../locales"
import { appWithStore } from "../types"
import console from "./log"

const getAppSlug = ({
  targetApp,
  defaultSlug = "",
  pathname = "/",
  baseApp,
}: {
  targetApp: appWithStore
  defaultSlug?: string
  pathname: string
  baseApp?: appWithStore
}): string => {
  const localeMatch = locales.find((loc) => {
    return pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  })

  const localePrefix = localeMatch ? `/${localeMatch}` : ""

  let computedSlug = defaultSlug

  // console.log(
  // `🚀 ~ computedSlug:`,
  // computedSlug,
  // targetApp?.name,
  // baseApp?.name,
  // )

  if (targetApp) {
    if (targetApp.id === baseApp?.id) {
      computedSlug = defaultSlug
      // console.log(
      // `🚀 ~ computedSlug 1:`,
      // computedSlug,
      // targetApp?.name,
      // baseApp?.name,
      // )
    } else if (
      targetApp.store?.slug === baseApp?.store?.slug ||
      baseApp?.store?.apps?.some((app) => app.slug === targetApp.slug)
    ) {
      // Same store: just use the app slug
      computedSlug = `/${targetApp.slug}`
      // console.log(
      // `🚀 ~ computedSlug 2:`,
      // computedSlug,
      // targetApp?.name,
      // baseApp?.name,
      // )
    } else {
      // Different store: include store slug
      computedSlug = `/${targetApp.store?.slug}/${targetApp.slug}`
      // console.log(
      // `🚀 ~ computedSlug 3:`,
      // computedSlug,
      // targetApp?.name,
      // baseApp?.name,
      // )
    }
  }

  if (localePrefix) {
    if (!computedSlug || computedSlug === "/") {
      // console.log(
      // `🚀 ~ computedSlug 4:`,
      // computedSlug,
      // targetApp?.name,
      // baseApp?.name,
      // )
      return localePrefix || "/"
    }

    if (
      computedSlug === localePrefix ||
      computedSlug.startsWith(`${localePrefix}/`)
    ) {
      // console.log(
      // `🚀 ~ computedSlug 5:`,
      // computedSlug,
      // targetApp?.name,
      // baseApp?.name,
      // )
      return computedSlug
    }

    if (computedSlug.startsWith("/")) {
      // console.log(
      // `🚀 ~ computedSlug 6:`,
      // computedSlug,
      // targetApp?.name,
      // baseApp?.name,
      // )
      return `${localePrefix}${computedSlug}`
    }

    return `${localePrefix}/${computedSlug}`
  }

  return computedSlug || defaultSlug
}

export default getAppSlug
