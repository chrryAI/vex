import type { RouterState } from "ui/hooks/useWindowHistory"

export interface RenderResult {
  html: string
  state: RouterState
  head: string
}

/**
 * Server-side render function
 * Returns empty shell - client will render everything
 * This avoids @lobehub directory import errors in SSR
 */
export function render(url: string): RenderResult {
  const parsedUrl = new URL(url, "http://localhost")
  const pathname =
    parsedUrl.pathname === "/index.html" ? "/" : parsedUrl.pathname

  const routerState: RouterState = {
    pathname,
    searchParams: parsedUrl.searchParams,
    hash: parsedUrl.hash,
  }

  // Return empty HTML - React will render on client
  const html = ""

  const head = `
    <meta name="description" content="Fast SSR with Vite + React" />
    <style>
      #root { min-height: 100vh; }
      .loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
    </style>
  `

  return { html, state: routerState, head }
}
