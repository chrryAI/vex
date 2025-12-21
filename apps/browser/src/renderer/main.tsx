import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import "./index.css"

function App() {
  const [pingResult, setPingResult] = useState<string>("")

  useEffect(() => {
    // Test the IPC bridge
    window.electronAPI.ping().then((result) => {
      setPingResult(result)
      console.log("IPC Bridge working:", result)
    })
  }, [])

  return (
    <div className="app">
      <h1>🚀 Vex Browser</h1>
      <p>Generic Electron Browser Foundation</p>
      <div className="status">
        <strong>IPC Status:</strong> {pingResult || "Testing..."}
      </div>
      <div className="info">
        <p>This is the white-label browser foundation.</p>
        <p>Sushi, Vex, and Chrry browsers will use this core.</p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
