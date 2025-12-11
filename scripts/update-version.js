const fs = require("fs")
const path = require("path")

// 1. Get new version (manual or auto-increment)
function incrementPatch(version) {
  const parts = version.split(".").map(Number)
  if (parts.length !== 3) throw new Error("Version must have format X.Y.Z")
  let [major, minor, patch] = parts

  if (patch < 99) {
    patch += 1
  } else if (minor < 99) {
    patch = 0
    minor += 1
  } else {
    // patch == 99, minor == 99
    patch = 0
    minor = 0
    major += 1
  }

  return [major, minor, patch].join(".")
}

const versionArg = process.argv[2]
const versionFilePath = path.resolve(__dirname, "..", "VERSION")
let oldVersion = fs.readFileSync(versionFilePath, "utf8").trim()
let newVersion
if (versionArg) {
  newVersion = versionArg
} else {
  newVersion = incrementPatch(oldVersion)
}

// Android versionCode = patch number
const versionCode = Number(newVersion.split(".")[2])
if (isNaN(versionCode))
  throw new Error("Patch version for versionCode must be a number")
console.log("Using version:", newVersion, "versionCode:", versionCode)

// 2. List of files to update
const files = [
  "VERSION",
  "package.json",
  "apps/extension/package.json",
  "apps/extension/vite.config.ts",
  "apps/web/package.json",
  "packages/ui/package.json",
  "packages/pepper/package.json",
  "packages/ui/context/providers/DataProvider.tsx",
  "packages/waffles/package.json",
  "packages/ui/utils/index.ts",
  "packages/db/package.json",
  "apps/flash/server.js",
].map((f) => path.resolve(__dirname, "..", f))

function updatePackageJson(file, version) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"))
  json.version = version
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8")
  console.log(`Updated version in ${file}`)
}

// 4. Helper to replace version in text/code files
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function replaceVersionInFile(file, oldVersion, newVersion) {
  let content = fs.readFileSync(file, "utf8")
  // Replace versionName
  content = content.replace(
    new RegExp(escapeRegExp(oldVersion), "g"),
    newVersion,
  )
  // For Android build.gradle: update versionCode
  if (file.endsWith("build.gradle")) {
    content = content.replace(/versionCode \d+/g, `versionCode ${versionCode}`)
    console.log(`Set versionCode to ${versionCode} in ${file}`)
  }
  fs.writeFileSync(file, content, "utf8")
  console.log(`Replaced version in ${file}`)
}

// 5. Get the previous version from VERSION file
const versionFile = files[0]

// 6. Update VERSION file
fs.writeFileSync(versionFile, newVersion + "\n", "utf8")
console.log(`Set VERSION file to ${newVersion}`)

// 7. Update each file
files.slice(1).forEach((file) => {
  if (file.endsWith("package.json")) {
    updatePackageJson(file, newVersion)
  } else {
    replaceVersionInFile(file, oldVersion, newVersion)
  }
})
