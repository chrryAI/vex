import React from "react"
import "../styles/browser-chrome.css"

interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
}

interface TabProps {
  tab: Tab
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

export function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  return (
    <div
      className={`tab ${isActive ? "active" : ""}`}
      onClick={onSelect}
      title={tab.title}
    >
      {tab.favicon && <img src={tab.favicon} alt="" className="tab-favicon" />}
      <span className="tab-title">{tab.title || "New Tab"}</span>
      <button
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  )
}

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void
  onNewTab: () => void
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
}: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => onTabSelect(tab.id)}
            onClose={() => onTabClose(tab.id)}
          />
        ))}
      </div>
      <button className="new-tab-btn" onClick={onNewTab} aria-label="New tab">
        +
      </button>
    </div>
  )
}
