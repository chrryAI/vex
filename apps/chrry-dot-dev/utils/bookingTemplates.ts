// Booking automation templates to reduce prompt size by 80-90%
// Instead of sending 2000+ line prompts, use focused templates

export interface BookingContext {
  elements?: any[]
  wrapperHTML?: string
  pageInfo?: any
  siteConfig?: string
  userRequest?: any
  context?: any
  stats?: any
}

export interface BookingTemplate {
  name: string
  prompt: string
  maxTokens: number
}

// Core booking instructions (shared across all templates)
const CORE_INSTRUCTIONS = `You are an expert web automation assistant. Analyze the page and provide the next action.

**RESPONSE FORMAT:** "<emoji> <brief status> ACTION: [{JSON}]"

**ACTION TYPES:**
- "click_element": Click element (use semanticTarget when possible)
- "fill_input": Fill input field
- "select_option": Select dropdown option
- "wait_and_retry": Wait and retry
- "request_user_input": Ask user for info
- "booking_complete": Process complete

**SEMANTIC TARGETING:** Use semanticTarget instead of elementIndex when possible:
- "date_picker", "time_selector", "party_size", "restaurant_search", "submit_button"
- Include targetKeywords: ["date", "calendar", "time", etc.]

**EXAMPLES:**
- "🔍 Filling restaurant search ACTION: [{\"type\": \"fill_input\", \"params\": {\"semanticTarget\": \"restaurant_search\", \"targetKeywords\": [\"restaurant\", \"search\"], \"text\": \"Singel 101 Restaurant\", \"reason\": \"Enter restaurant name\"}}]"
- "📅 Opening date picker ACTION: [{\"type\": \"click_element\", \"params\": {\"semanticTarget\": \"date_picker\", \"targetKeywords\": [\"date\", \"calendar\"], \"reason\": \"Open date selection\"}}]"

**CRITICAL:** Current date is August 7, 2025. "Next Sunday" = August 11, 2025.`

// Template for search/form filling phase
const SEARCH_TEMPLATE: BookingTemplate = {
  name: "search_form",
  prompt: `${CORE_INSTRUCTIONS}

**PRIORITY ORDER:**
1. DATE first (click date picker, select date)
2. TIME second (click time selector)
3. PARTY SIZE third (fill/select guests)
4. RESTAURANT fourth (fill search field)
5. SUBMIT (click search/find button)

**CALENDAR NAVIGATION:**
- Check displayed month/year vs target date
- Navigate to correct month BEFORE selecting date
- Use "times" property for multi-month navigation
- NEVER select dates from wrong month/year

**SEARCH-FIRST APPROACH:**
- Always prefer search forms over clicking restaurant cards
- Fill all criteria before submitting
- Handle readonly inputs by clicking them first`,
  maxTokens: 300,
}

// Template for selection phase (choosing from results)
const SELECTION_TEMPLATE: BookingTemplate = {
  name: "selection",
  prompt: `${CORE_INSTRUCTIONS}

**SELECTION PHASE:**
- Choose from search results or available options
- Look for time slots, restaurant cards, or booking buttons
- Avoid carousel navigation - prefer direct selection
- Check for already-selected elements (aria-selected="true")

**PRIORITY:**
1. Select best matching time slot
2. Choose appropriate restaurant option
3. Click booking/reserve button`,
  maxTokens: 200,
}

// Template for form completion phase
const FORM_COMPLETION_TEMPLATE: BookingTemplate = {
  name: "form_completion",
  prompt: `${CORE_INSTRUCTIONS}

**FORM COMPLETION:**
- Fill contact information (name, phone, email)
- Complete any additional booking details
- Handle special requests or preferences
- Submit final booking form

**VALIDATION:**
- Ensure all required fields are filled
- Check for form validation errors
- Look for confirmation or success messages`,
  maxTokens: 200,
}

// Template for calendar navigation
const CALENDAR_TEMPLATE: BookingTemplate = {
  name: "calendar_navigation",
  prompt: `${CORE_INSTRUCTIONS}

**🚨 CRITICAL: DATE PICKER PRIORITY 🚨**
**ALWAYS handle date picker FIRST before any other inputs!**
**NEVER fill restaurant search until date is set!**

**CALENDAR NAVIGATION RULES:**
- Current UTC date: {CURRENT_UTC_DATE}
- Target: "next Sunday" = {TARGET_DATE}
- Check displayed month/year in calendar header
- Navigate to correct month BEFORE selecting date

**MANDATORY STEPS (IN ORDER):**
1. 🗓️ FIRST: Click date picker to open calendar
2. 📅 Check displayed month (if not August 2025, navigate)
3. ⬅️ Use prev/next month buttons with "times" property
4. ✅ Select August 11, 2025 (next Sunday)
5. 🔍 ONLY THEN proceed to restaurant search

**MONTH NAVIGATION CALCULATION:**
- Current displayed: February 2025 (Feb = 2)
- Target month: August 2025 (Aug = 8)
- Clicks needed: 8 - 2 = 6 clicks forward
- ALWAYS use "times": 6 for Feb→Aug navigation

**CRITICAL: Use exact "times" values:**
- Feb→Aug = times: 6
- Mar→Aug = times: 5  
- Apr→Aug = times: 4
- If going backward, use "prev_month" with appropriate times

**EXAMPLES:**
- "📅 Opening date picker ACTION: [{\"type\": \"click_element\", \"params\": {\"semanticTarget\": \"date_picker\", \"targetKeywords\": [\"date\", \"calendar\"], \"reason\": \"Open date selection - PRIORITY 1\"}}]"
- "⬅️ Navigate to August ACTION: [{\"type\": \"click_element\", \"params\": {\"semanticTarget\": \"next_month\", \"times\": 6, \"reason\": \"Navigate from Feb to August (6 clicks)\"}}]"
- "📅 Select Sunday 11th ACTION: [{\"type\": \"click_element\", \"params\": {\"semanticTarget\": \"date_11\", \"targetKeywords\": [\"11\", \"sunday\"], \"reason\": \"Select August 11, 2025\"}}]"

**FORBIDDEN:** 
- Never fill restaurant search before setting date!
- Never select dates from wrong month/year!
- Never skip date picker if it exists!`,
  maxTokens: 400,
}

// Template for error handling/retry
const ERROR_TEMPLATE: BookingTemplate = {
  name: "error_handling",
  prompt: `${CORE_INSTRUCTIONS}

**ERROR HANDLING:**
- Analyze what went wrong in previous step
- Suggest alternative approach or retry
- Look for error messages or validation issues
- Request user input if information is missing

**COMMON ISSUES:**
- Page not loaded completely
- Elements not clickable yet
- Missing required information
- Network/timeout issues`,
  maxTokens: 150,
}

// Template selector based on page analysis
export function selectBookingTemplate(
  context: BookingContext,
): BookingTemplate {
  const { stats, elements, userRequest, pageInfo } = context

  // PRIORITY 1: Check for date picker elements (HIGHEST PRIORITY)
  const hasDatePicker = elements?.some((el: any) => {
    const text = el.textContent?.toLowerCase() || ""
    const id = el.id?.toLowerCase() || ""
    const className = el.className?.toLowerCase() || ""
    const dataTest = el.dataTest?.toLowerCase() || ""
    const ariaLabel = el.ariaLabel?.toLowerCase() || ""

    return (
      // Existing checks
      el.matchesPriority?.dateInput ||
      id.includes("date") ||
      className.includes("date") ||
      dataTest.includes("date") ||
      dataTest.includes("day-picker") ||
      ariaLabel.includes("date") ||
      el.textContent?.match(/^[A-Z][a-z]{2}\s+\d{1,2}$/) || // "Feb 17" format
      // Enhanced detection for OpenTable and booking sites
      text.match(
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}$/i,
      ) ||
      text.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/) || // Date format
      className.includes("picker") ||
      className.includes("calendar") ||
      id.includes("picker") ||
      id.includes("calendar") ||
      ariaLabel.includes("calendar") ||
      ariaLabel.includes("picker") ||
      (el.tagName === "INPUT" &&
        (el.type === "date" || el.placeholder?.toLowerCase().includes("date")))
    )
  })

  // PRIORITY 2: Check if this is calendar navigation
  const isCalendarNavigation = elements?.some(
    (el: any) =>
      el.textContent?.toLowerCase().includes("month") ||
      el.textContent?.toLowerCase().includes("calendar") ||
      el.className?.includes("calendar"),
  )

  // Analyze page to determine current phase
  const hasSearchInputs = (stats?.searchInputs || 0) > 0
  const hasTimeSlots = (stats?.timeSlots || 0) > 0
  const hasBookingButtons = (stats?.bookingButtons || 0) > 0
  const hasFormInputs = elements?.some(
    (el: any) =>
      el.tagName === "INPUT" &&
      (el.type === "text" || el.type === "email" || el.type === "tel"),
  )

  // Check URL/title for booking phase indicators
  const url = pageInfo?.url?.toLowerCase() || ""
  const title = pageInfo?.title?.toLowerCase() || ""
  const isConfirmationPage =
    url.includes("confirm") || title.includes("confirm")

  // DEBUG: Log detection results
  console.log("🔍 Template Selection Debug:", {
    hasDatePicker,
    isCalendarNavigation,
    hasSearchInputs,
    hasTimeSlots,
    hasBookingButtons,
    hasFormInputs,
    isConfirmationPage,
    elementsCount: elements?.length || 0,
    url: pageInfo?.url,
  })

  // Log elements that might be date pickers
  const datePickerElements = elements?.filter(
    (el: any) =>
      el.matchesPriority?.dateInput ||
      el.id?.includes("date") ||
      el.className?.includes("date") ||
      el.dataTest?.includes("date") ||
      el.dataTest?.includes("day-picker") ||
      el.ariaLabel?.toLowerCase().includes("date") ||
      el.textContent?.match(/^[A-Z][a-z]{2}\s+\d{1,2}$/),
  )
  console.log(
    "📅 Date picker elements found:",
    datePickerElements?.length || 0,
    datePickerElements?.map((el) => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      textContent: el.textContent?.substring(0, 50),
      dataTest: el.dataTest,
    })),
  )

  // Template selection logic - DATE PICKER FIRST!
  let selectedTemplate: BookingTemplate
  if (hasDatePicker || isCalendarNavigation) {
    selectedTemplate = CALENDAR_TEMPLATE
    console.log("✅ Selected CALENDAR_TEMPLATE (date picker priority)")
  } else if (hasTimeSlots || hasBookingButtons) {
    selectedTemplate = SELECTION_TEMPLATE
    console.log("✅ Selected SELECTION_TEMPLATE")
  } else if (hasFormInputs || isConfirmationPage) {
    selectedTemplate = FORM_COMPLETION_TEMPLATE
    console.log("✅ Selected FORM_COMPLETION_TEMPLATE")
  } else if (hasSearchInputs) {
    selectedTemplate = SEARCH_TEMPLATE
    console.log("✅ Selected SEARCH_TEMPLATE")
  } else {
    selectedTemplate = CALENDAR_TEMPLATE
    console.log("✅ Selected CALENDAR_TEMPLATE (default)")
  }

  return selectedTemplate
}

// Generate minimal prompt with selected template
export function generateBookingPrompt(context: BookingContext): string {
  const template = selectBookingTemplate(context)
  const { elements, pageInfo, userRequest, stats } = context

  // Get current UTC date and calculate target date
  const currentUTC = new Date().toISOString()
  const currentDate = new Date()

  // Calculate "next Sunday" from current date
  const daysUntilSunday = (7 - currentDate.getDay()) % 7 || 7
  const nextSunday = new Date(currentDate)
  nextSunday.setDate(currentDate.getDate() + daysUntilSunday)
  const targetDate = nextSunday.toISOString().split("T")[0] // YYYY-MM-DD format

  // Minimal context (reduced from 8000+ chars to ~500)
  const minimalElements =
    elements
      ?.slice(0, 10)
      .map((el: any, index: number) => {
        return `[${index}] ${el.tagName}${el.id ? `#${el.id}` : ""} "${el.textContent?.substring(0, 50) || ""}"`
      })
      .join("\n") || "No elements"

  const minimalStats = `Elements: ${stats?.totalElements || 0}, Times: ${stats?.timeSlots || 0}, Buttons: ${stats?.bookingButtons || 0}`

  // Replace placeholders in template with actual dates
  const basePrompt = template?.prompt || ""
  const promptWithDates = basePrompt
    .replace(/\{CURRENT_UTC_DATE\}/g, currentUTC || "")
    .replace(/\{TARGET_DATE\}/g, targetDate || "")

  return `${promptWithDates}

**USER REQUEST:** ${JSON.stringify(userRequest)}
**PAGE:** ${pageInfo?.url || "Unknown"} - ${pageInfo?.title || "Unknown"}
**STATS:** ${minimalStats}

**TOP ELEMENTS:**
${minimalElements}

Provide next action:`
}

// Rate limit error handling with exponential backoff
export function handleRateLimit(attempt: number = 1): number {
  const baseDelay = 1000 // 1 second
  const maxDelay = 30000 // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)

  console.log(`Rate limit hit. Retrying in ${delay}ms (attempt ${attempt})`)
  return delay
}

// Template for messages route booking automation
const MESSAGES_BOOKING_TEMPLATE: BookingTemplate = {
  name: "messages_booking",
  prompt: `**BOOKING AUTOMATION RULES:**
- book_reservation: Help with booking tables, trips, etc. (IMPORTANT: Only trigger when you have ALL required information: party size, date, time, and location/restaurant)
- Required information: party size (number of people), date, time, restaurant/location
- If ANY information is missing, ask for it: "I'd be happy to help you book a table! I need a few details: How many people? What date? What time? Any specific restaurant or location?"
- **CRITICAL: When you have ALL required information, AUTOMATICALLY trigger the book_reservation action**
- Do NOT ask "shall I proceed?" - immediately start the booking process
- Look at conversation history for previously provided information

**CURRENT UTC DATE:** {CURRENT_UTC_DATE}
**TARGET DATE CALCULATION:** {TARGET_DATE}

**BOOKING RESPONSE FORMAT:**
"Perfect! I have all the details needed to book your table:

Restaurant: [restaurant name]
Party size: [number] people
Date: [date]
Time: [time]

Let me handle the reservation for you. ACTION: [{\"type\": \"book_reservation\", \"params\": {\"partySize\": [number], \"date\": \"[date]\", \"time\": \"[time]\", \"restaurant\": \"[restaurant name]\"}}]"

**EXAMPLES:**
- "Book a table for 3 people tomorrow at 3:30 PM at Singel 101" → immediately respond with booking confirmation and ACTION`,
  maxTokens: 300,
}

// Generate booking template for messages route
export function generateMessagesBookingPrompt(): string {
  // Get current UTC date and calculate target date
  const currentUTC = new Date().toISOString()
  const currentDate = new Date()

  // Calculate "next Sunday" from current date
  const daysUntilSunday = (7 - currentDate.getDay()) % 7 || 7
  const nextSunday = new Date(currentDate)
  nextSunday.setDate(currentDate.getDate() + daysUntilSunday)
  const targetDate = nextSunday.toISOString().split("T")[0] // YYYY-MM-DD format

  // Replace placeholders in template with actual dates
  const basePrompt = MESSAGES_BOOKING_TEMPLATE?.prompt || ""
  const promptWithDates = basePrompt
    .replace(/\{CURRENT_UTC_DATE\}/g, currentUTC || "")
    .replace(/\{TARGET_DATE\}/g, targetDate || "")

  return promptWithDates
}

export const BOOKING_TEMPLATES = {
  SEARCH_TEMPLATE,
  SELECTION_TEMPLATE,
  FORM_COMPLETION_TEMPLATE,
  CALENDAR_TEMPLATE,
  ERROR_TEMPLATE,
  MESSAGES_BOOKING_TEMPLATE,
}
