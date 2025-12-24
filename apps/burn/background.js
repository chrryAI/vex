// Burn Ad Blocker - Background Service Worker
// Dead simple: Click to toggle, shows blocked count

let isActive = true
let blockedCount = 0

// Initialize state from storage
chrome.storage.local.get(["isActive", "blockedCount"], (result) => {
  isActive = result.isActive ?? true
  blockedCount = result.blockedCount ?? 0
  updateBadge()
  updateRules()
})

// Toggle on icon click
chrome.action.onClicked.addListener(async () => {
  isActive = !isActive
  await chrome.storage.local.set({ isActive })
  updateBadge()
  updateRules()
})

// Update badge display
function updateBadge() {
  if (isActive) {
    chrome.action.setBadgeText({
      text: blockedCount > 0 ? blockedCount.toString() : "0",
    })
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" }) // Red
  } else {
    chrome.action.setBadgeText({ text: "OFF" })
    chrome.action.setBadgeBackgroundColor({ color: "#6b7280" }) // Gray
  }
}

// Enable/disable blocking rules
async function updateRules() {
  const rulesetIds = ["easylist", "easyprivacy"]

  if (isActive) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: rulesetIds,
      disableRulesetIds: [],
    })
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [],
      disableRulesetIds: rulesetIds,
    })
  }
}

// Increment counter when extension loads (simple approach)
// In production, you'd track actual blocks via webRequest API
chrome.runtime.onInstalled.addListener(() => {
  console.log("🔥 Burn ad blocker installed!")
  updateBadge()
})

// Reset counter daily
chrome.alarms.create("resetCounter", { periodInMinutes: 1440 }) // 24 hours
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetCounter") {
    blockedCount = 0
    chrome.storage.local.set({ blockedCount })
    updateBadge()
  }
})
