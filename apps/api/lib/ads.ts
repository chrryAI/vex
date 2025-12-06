/**
 * Server-Side Google Ads Conversion Tracking
 * Zero client-side tracking - fully privacy compliant
 */

interface ConversionEvent {
  conversionId: string // AW-XXXXXXXXX
  conversionLabel: string // Your conversion label
  value?: number
  currency?: string
  transactionId?: string
}

/**
 * Send conversion to Google Ads (server-side only)
 * No cookies, no client tracking, no consent needed
 */
export async function trackGoogleAdsConversion({
  conversionId,
  conversionLabel,
  value,
  currency = "EUR",
  transactionId,
}: ConversionEvent): Promise<boolean> {
  try {
    // Google Ads Conversion API endpoint
    const url = `https://www.googleadservices.com/pagead/conversion/${conversionId}/?`

    const params = new URLSearchParams({
      label: conversionLabel,
      value: value?.toString() || "0",
      currency,
      ...(transactionId && { transaction_id: transactionId }),
    })

    const response = await fetch(url + params.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Chrry-Server/1.0",
      },
    })

    return response.ok
  } catch (error) {
    console.error("Failed to track Google Ads conversion:", error)
    return false
  }
}

/**
 * Track signup conversion
 */
export async function trackSignup(userId: string) {
  return trackGoogleAdsConversion({
    conversionId: process.env.GOOGLE_ADS_CONVERSION_ID!,
    conversionLabel: process.env.GOOGLE_ADS_SIGNUP_LABEL!,
    value: 0, // Free signup
    transactionId: `signup_${userId}`,
  })
}

/**
 * Track purchase conversion
 */
export async function trackPurchase(
  userId: string,
  amount: number,
  orderId: string,
) {
  return trackGoogleAdsConversion({
    conversionId: process.env.GOOGLE_ADS_CONVERSION_ID!,
    conversionLabel: process.env.GOOGLE_ADS_PURCHASE_LABEL!,
    value: amount,
    currency: "EUR",
    transactionId: orderId,
  })
}

/**
 * Track trial start
 */
export async function trackTrialStart(userId: string) {
  return trackGoogleAdsConversion({
    conversionId: process.env.GOOGLE_ADS_CONVERSION_ID!,
    conversionLabel: process.env.GOOGLE_ADS_TRIAL_LABEL!,
    value: 0,
    transactionId: `trial_${userId}`,
  })
}
