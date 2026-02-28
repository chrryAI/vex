import type { appWithStore } from "../types"

export const hasStoreApps = (app: appWithStore | undefined) => {
  return Boolean(app?.store?.app && app?.store?.apps.length)
}

export const merge = (prevApps: appWithStore[], newApps: appWithStore[]) => {
  // Create a map of existing apps by ID
  const existingAppsMap = new Map(prevApps.map((app) => [app.id, app]))

  // Add or update apps
  newApps.forEach((newApp) => {
    const existingApp = existingAppsMap.get(newApp.id)

    if (existingApp) {
      // Check if new app has meaningful store.apps (not empty or undefined)
      const newHasStoreApps = hasStoreApps(newApp)
      const existingHasStoreApps = hasStoreApps(existingApp)

      // Merge: prefer new app but preserve existing store.apps if new one is empty/undefined
      existingAppsMap.set(newApp.id, {
        ...existingApp,
        ...newApp,
        store: newHasStoreApps
          ? newApp.store
          : existingHasStoreApps
            ? existingApp.store
            : newApp.store,
      })
    } else {
      existingAppsMap.set(newApp.id, newApp)
    }
  })

  const result = Array.from(existingAppsMap.values())

  return result
}
