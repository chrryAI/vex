import "chrry/globals.scss"
import "chrry/globals.css"
import "chrry/styles/view-transitions.css"
import Chrry from "chrry/Chrry"
import { ServerData } from "./server-loader"
import { useAuth } from "chrry/hooks/useAuth"

interface AppProps {
  serverData?: ServerData
}

function App({ serverData }: AppProps) {
  // Use custom auth hook
  const auth = useAuth()

  // Create sign in wrapper to match Chrry's expected interface
  const signInContext = async (
    provider: "google" | "apple" | "credentials",
    options: {
      email?: string
      password?: string
      redirect?: boolean
      callbackUrl: string
      errorUrl?: string
      blankTarget?: boolean
    },
  ) => {
    if (provider === "google") {
      return auth.signInWithGoogle()
    } else if (provider === "apple") {
      return auth.signInWithApple()
    } else if (
      provider === "credentials" &&
      options.email &&
      options.password
    ) {
      return auth.signInWithPassword(options.email, options.password)
    }
    return { success: false, error: "Invalid provider or missing credentials" }
  }

  // Create sign out wrapper
  const signOutContext = async () => {
    return auth.signOut()
  }

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
        <pre
          style={{
            background: "#1a1a1a",
            padding: "20px",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(serverData, null, 2)}
        </pre>
      </div>
    )
  }

  // Handle session errors
  if (serverData?.session?.error) {
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
        app={serverData?.app}
        viewPortWidth={serverData?.viewPortWidth}
        viewPortHeight={serverData?.viewPortHeight}
        signInContext={signInContext}
        signOutContext={signOutContext}
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
