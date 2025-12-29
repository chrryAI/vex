import "@chrryai/chrry/globals.scss"
import Chrry from "@chrryai/chrry/Chrry"
import { HistoryRouterProvider } from "@chrryai/pepper"
import { Component, ReactNode } from "react"

// Error Boundary to catch crashes
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("React Error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", color: "white", background: "#000" }}>
          <h1>⚠️ App Crashed</h1>
          <pre
            style={{ color: "red", fontSize: "12px", whiteSpace: "pre-wrap" }}
          >
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  console.log("🍒 App mounting...")

  return (
    <ErrorBoundary>
      <HistoryRouterProvider>
        <Chrry />
      </HistoryRouterProvider>
    </ErrorBoundary>
  )
}

export default App
