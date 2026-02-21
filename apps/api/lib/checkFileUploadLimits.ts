import { isDevelopment, isE2E } from "@chrryai/chrry/utils"
import type { guest, subscription, user } from "@repo/db"
import { updateGuest, updateUser } from "@repo/db"
import { captureException } from "./captureException"

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export const FILE_UPLOAD_LIMITS = {
  member: {
    maxFilesPerHour: 10,
    maxFilesPerDay: 30,
    maxTotalSizeMBPerDay: 200,
    maxFileSizeMB: 25,
  },
  subscriber: {
    maxFilesPerHour: 30,
    maxFilesPerDay: 150,
    maxTotalSizeMBPerDay: 1000,
    maxFileSizeMB: 200,
  },
  guest: {
    maxFilesPerHour: 5,
    maxFilesPerDay: 15,
    maxTotalSizeMBPerDay: 100,
    maxFileSizeMB: 10,
  },
}

export const getUploadLimits = ({
  user,
  guest,
}: {
  guest?: guest & { subscription?: subscription }
  user?: user & { subscription?: subscription }
}) => {
  if (!user && !guest) return FILE_UPLOAD_LIMITS.guest
  if (user?.subscription || guest?.subscription)
    return FILE_UPLOAD_LIMITS.subscriber
  return user ? FILE_UPLOAD_LIMITS.member : FILE_UPLOAD_LIMITS.guest
}

// Check and update file upload rate limits
const checkFileUploadLimits = async ({
  member,
  guest,
  files,
}: {
  member?: user & { subscription?: subscription }
  files: File[]
  guest?: guest
}): Promise<{
  allowed: boolean
  error?: string
  resetInfo?: string
  quotaInfo?: {
    hourly: { used: number; limit: number; resetTime: string }
    daily: { used: number; limit: number; resetTime: string }
    dailySize: { used: number; limit: number; resetTime: string }
  }
}> => {
  if (isDevelopment || isE2E) return { allowed: true }

  if ((!member && !guest) || files.length === 0) {
    return { allowed: true }
  }

  const limits = getUploadLimits({ user: member, guest })
  const currentUser = member || guest

  if (!limits || !currentUser) {
    return { allowed: true }
  }

  const tooLarge = files.find(
    (f) => f.size > limits.maxFileSizeMB * 1024 * 1024,
  )
  if (tooLarge) {
    return {
      allowed: false,
      error: `File "${tooLarge.name}" exceeds the ${limits.maxFileSizeMB}MB limit.`,
    }
  }

  const now = new Date()
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const thisHourUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
    ),
  )

  // Check if we need to reset counters
  const lastReset = currentUser.lastFileUploadReset
    ? new Date(currentUser.lastFileUploadReset)
    : null
  const needsDailyReset = !lastReset || lastReset < todayUTC
  const needsHourlyReset = !lastReset || lastReset < thisHourUTC

  let currentHourlyUploads = currentUser.fileUploadsThisHour || 0
  let currentDailyUploads = currentUser.fileUploadsToday || 0
  let currentDailySize = currentUser.totalFileSizeToday || 0
  let _currentDailyImages = currentUser.imagesGeneratedToday || 0

  // Reset counters if needed
  if (needsDailyReset) {
    currentDailyUploads = 0
    currentDailySize = 0
    _currentDailyImages = 0
    currentHourlyUploads = 0
  } else if (needsHourlyReset) {
    currentHourlyUploads = 0
  }

  // Calculate new totals with current upload
  const newHourlyUploads = currentHourlyUploads + files.length
  const newDailyUploads = currentDailyUploads + files.length
  const totalNewSizeBytes = files.reduce((sum, file) => sum + file.size, 0)
  const totalNewSizeMB = totalNewSizeBytes / (1024 * 1024)
  const newDailySize = currentDailySize + totalNewSizeMB

  // Check limits
  if (newHourlyUploads > limits.maxFilesPerHour) {
    const nextHour = new Date(thisHourUTC.getTime() + ONE_HOUR_MS)
    return {
      allowed: false,
      error: "Hourly file upload limit exceeded",
      resetInfo: `You can upload more files after ${nextHour.toLocaleTimeString()}. Current: ${currentHourlyUploads}/${limits.maxFilesPerHour} files this hour.`,
    }
  }

  if (newDailyUploads > limits.maxFilesPerDay) {
    const tomorrow = new Date(todayUTC.getTime() + ONE_DAY_MS)
    return {
      allowed: false,
      error: "Daily file upload limit exceeded",
      resetInfo: `You can upload more files after ${tomorrow.toLocaleDateString()}. Current: ${currentDailyUploads}/${limits.maxFilesPerDay} files today.`,
    }
  }

  if (newDailySize > limits.maxTotalSizeMBPerDay) {
    const tomorrow = new Date(todayUTC.getTime() + ONE_DAY_MS)
    return {
      allowed: false,
      error: "Daily file size limit exceeded",
      resetInfo: `You can upload more files after ${tomorrow.toLocaleDateString()}. Current: ${currentDailySize.toFixed(1)}MB/${limits.maxTotalSizeMBPerDay}MB today.`,
    }
  }

  // Calculate quota info for client
  const nextHour = new Date(thisHourUTC.getTime() + ONE_HOUR_MS)
  const tomorrow = new Date(todayUTC.getTime() + ONE_DAY_MS)

  const quotaInfo = {
    hourly: {
      used: newHourlyUploads,
      limit: limits.maxFilesPerHour,
      resetTime: nextHour.toISOString(),
    },
    daily: {
      used: newDailyUploads,
      limit: limits.maxFilesPerDay,
      resetTime: tomorrow.toISOString(),
    },
    dailySize: {
      used: Math.round(newDailySize * 10) / 10, // Round to 1 decimal
      limit: limits.maxTotalSizeMBPerDay,
      resetTime: tomorrow.toISOString(),
    },
  }

  // Update counters in database
  try {
    member &&
      (await updateUser({
        id: member.id,
        fileUploadsThisHour: newHourlyUploads,
        fileUploadsToday: newDailyUploads,
        totalFileSizeToday: Math.round(newDailySize),
        lastFileUploadReset: now,
      }))

    member &&
      console.log(`📊 File upload limits updated:`, {
        userId: member.id,
        hourly: `${newHourlyUploads}/${limits.maxFilesPerHour}`,
        daily: `${newDailyUploads}/${limits.maxFilesPerDay}`,
        sizeMB: `${newDailySize.toFixed(1)}/${limits.maxTotalSizeMBPerDay}`,
      })

    guest &&
      (await updateGuest({
        id: guest.id,
        fileUploadsThisHour: newHourlyUploads,
        fileUploadsToday: newDailyUploads,
        totalFileSizeToday: Math.round(newDailySize),
        lastFileUploadReset: now,
      }))

    guest &&
      console.log(`📊 File upload limits updated:`, {
        userId: guest.id,
        hourly: `${newHourlyUploads}/${limits.maxFilesPerHour}`,
        daily: `${newDailyUploads}/${limits.maxFilesPerDay}`,
        sizeMB: `${newDailySize.toFixed(1)}/${limits.maxTotalSizeMBPerDay}`,
      })
  } catch (error) {
    captureException(error)
    console.error("❌ Failed to update file upload counters:", error)
    // Allow the upload to proceed even if counter update fails
  }

  return { allowed: true, quotaInfo }
}

export default checkFileUploadLimits
