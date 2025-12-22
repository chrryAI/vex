import React, { useState } from "react"
import "../styles/browser-chrome.css"

interface BrowserHeaderProps {
  url: string
  canGoBack: boolean
  canGoForward: boolean
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onReload: () => void
}

export function BrowserHeader({
  url,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onReload,
}: BrowserHeaderProps) {
  const [urlInput, setUrlInput] = useState(url)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let finalUrl = urlInput.trim()

    // Add protocol if missing
    if (!finalUrl.match(/^https?:\/\//)) {
      // Check if it looks like a URL
      if (finalUrl.includes(".") && !finalUrl.includes(" ")) {
        finalUrl = `https://${finalUrl}`
      } else {
        // Treat as search query
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`
      }
    }

    onNavigate(finalUrl)
  }

  // Update input when URL prop changes
  React.useEffect(() => {
    setUrlInput(url)
  }, [url])

  return (
    <div className="browser-header">
      <div className="nav-controls">
        <button
          className="nav-btn"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Go back"
        >
          ←
        </button>
        <button
          className="nav-btn"
          onClick={onForward}
          disabled={!canGoForward}
          aria-label="Go forward"
        >
          →
        </button>
        <button className="nav-btn" onClick={onReload} aria-label="Reload">
          ⟳
        </button>
      </div>

      <form className="url-bar-container" onSubmit={handleSubmit}>
        <input
          type="text"
          className="url-bar"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Search or enter URL"
        />
      </form>

      <div className="extension-tray">
        <button className="extension-icon" title="Extensions">
          🧩
        </button>
      </div>
    </div>
  )
}
