import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { TabBar } from "./components/TabBar"
import { BrowserHeader } from "./components/BrowserHeader"
import AppProviders from "@chrryai/chrry/context/providers"
import "./styles/browser-chrome.css"

interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "1", url: "https://www.google.com", title: "Google" },
  ])
  const [activeTabId, setActiveTabId] = useState("1")
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  useEffect(() => {
    // Test the IPC bridge
    if (window.electronAPI) {
      window.electronAPI.ping().then((result: string) => {
        console.log("IPC Bridge working:", result)
      })
    } else {
      console.error(
        "electronAPI is undefined - preload script may not have loaded",
      )
    }
  }, [])

  const handleNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: "https://www.google.com",
      title: "New Tab",
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
  }

  const handleCloseTab = (id: string) => {
    const newTabs = tabs.filter((t) => t.id !== id)
    if (newTabs.length === 0) {
      // Create a new tab if all tabs are closed
      handleNewTab()
    } else {
      setTabs(newTabs)
      if (activeTabId === id) {
        setActiveTabId(newTabs[0].id)
      }
    }
  }

  const handleNavigate = (url: string) => {
    setTabs(
      tabs.map((t) =>
        t.id === activeTabId ? { ...t, url, title: new URL(url).hostname } : t,
      ),
    )
    // TODO: Send navigation command to main process
    console.log("Navigate to:", url)
  }

  const handleBack = () => {
    // TODO: Implement back navigation
    console.log("Go back")
  }

  const handleForward = () => {
    // TODO: Implement forward navigation
    console.log("Go forward")
  }

  const handleReload = () => {
    // TODO: Implement reload
    console.log("Reload")
  }

  return (
    <div className="app">
      <BrowserHeader
        url={activeTab?.url || ""}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleCloseTab}
        onNewTab={handleNewTab}
      />
      <div className="web-content">
        <div className="web-content-placeholder">
          <div className="status-info">
            <h1>🚀 Vex Browser</h1>
            <p>Active Tab: {activeTab?.title}</p>
            <p>URL: {activeTab?.url}</p>
            <p className="info-text">
              Web content will be displayed here using BrowserView
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
