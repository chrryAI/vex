import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"
import Chrry from "chrry/Chrry"
import { ServerData } from "./server-loader"

interface AppProps {
  serverData?: ServerData
}

function App({ serverData }: AppProps) {
  // Debug: Log server data

  // Handle API errors
  if (serverData?.apiError) {
    return (
      <div
        style={{
          fontFamily: "system-ui",
          padding: "40px",
          maxWidth: "800px",
          margin: "0 auto",
          background: "#0a0a0a",
          color: "#e5e5e5",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          <h1 style={{ color: "#ef4444", margin: "0 0 16px 0" }}>
            🚨 API Connection Error
          </h1>
          <p>Unable to connect to the API server.</p>
          <div
            style={{
              background: "#2a2a2a",
              padding: "16px",
              borderRadius: "4px",
              margin: "16px 0",
              fontFamily: "monospace",
              fontSize: "14px",
            }}
          >
            <strong>Error:</strong> {serverData.apiError.message}
          </div>
          <div style={{ marginTop: "16px", fontSize: "14px", opacity: 0.7 }}>
            <p>
              <strong>Site:</strong> {serverData.siteConfig.url}
            </p>
            <p>
              <strong>Locale:</strong> {serverData.locale}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Handle session errors
  if (serverData?.session && "error" in serverData.session) {
    return (
      <div
        style={{
          fontFamily: "system-ui",
          padding: "40px",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <h1 style={{ color: "#ef4444" }}>Session Error</h1>
        <p>{serverData.session.error as unknown as string}</p>
      </div>
    )
  }

  return (
    <>
      {/* Debug render outside Chrry */}
      <Chrry
        locale={serverData?.locale as any}
        session={serverData?.session}
        thread={serverData?.thread}
        threads={serverData?.threads}
        translations={serverData?.translations}
        viewPortWidth={serverData?.viewPortWidth}
        viewPortHeight={serverData?.viewPortHeight}
      >
        <main>
          <h1>Chrry on Vite SSR ⚡️</h1>
          <p>Testing streaming SSR performance</p>

          {serverData && (
            <div
              style={{ marginTop: "2rem", fontSize: "0.875rem", opacity: 0.7 }}
            >
              <p>Site: {serverData.siteConfig.name}</p>
              <p>Mode: {serverData.siteConfig.mode}</p>
              <p>Domain: {serverData.siteConfig.domain}</p>
              <p>
                Environment: {serverData.isDev ? "Development" : "Production"}
              </p>
              <p>Theme: {serverData.theme}</p>
              {serverData.session && "user" in serverData.session && (
                <p>User: {serverData.session.user?.email || "Guest"}</p>
              )}
            </div>
          )}
        </main>
      </Chrry>
    </>
  )
}

export default App
