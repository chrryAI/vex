import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false, // Frameless for custom drag handle
    transparent: false,
    alwaysOnTop: true, // Always on top when idle
    show: false, // Don't show immediately (will show from tray)
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    backgroundColor: "#000000",
  })

  // Load the app
  if (!app.isPackaged) {
    // Development mode - load from Vite dev server
    mainWindow.loadURL("http://localhost:5174")
    mainWindow.webContents.openDevTools()
  } else {
    // Production mode - load from built files
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"))
  }

  // True close behavior - quit app instead of hiding
  mainWindow.on("close", () => {
    app.quit()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

function createTray() {
  // Create tray icon (template image for dark/light mode)
  const iconPath = path.join(__dirname, "../../assets/tray-icon.png")
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip("Vex Browser")

  // Tray menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Browser",
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Click tray icon to toggle window
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    } else {
      createWindow()
    }
  })
}

// App lifecycle
app.whenReady().then(() => {
  // Hide dock icon on Mac
  if (process.platform === "darwin") {
    app.dock.hide()
  }

  createTray()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  // Don't quit on window close - keep tray icon active
  // User must quit from tray menu
})

// IPC Handlers
ipcMain.handle("ping", () => "pong")
ipcMain.handle("window:minimize", () => mainWindow?.minimize())
ipcMain.handle("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

console.log("🚀 Electron browser started")
