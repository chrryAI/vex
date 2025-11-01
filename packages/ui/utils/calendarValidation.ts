import { z } from "zod"

// Base attendee schema
const attendeeSchema = z.object({
  email: z.email("Invalid email address"),
  name: z.string().optional(),
  status: z.enum(["pending", "accepted", "declined"]).default("pending"),
  isOrganizer: z.boolean().optional(),
})

// Base reminder schema
const reminderSchema = z.object({
  type: z.enum(["email", "notification", "popup"]),
  minutesBefore: z.number().min(0, "Minutes before must be positive"),
  sent: z.boolean().optional(),
})

// Recurrence rule schema
const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().min(1, "Interval must be at least 1"),
  endDate: z.string().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  weekOfMonth: z.number().min(1).max(5).optional(),
})

// AI context schema
const aiContextSchema = z.object({
  originalPrompt: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  suggestedBy: z.string().optional(),
})

// Create calendar event schema
export const createCalendarEventSchema = z
  .object({
    // Required fields
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title must be less than 200 characters"),
    startTime: z.date(),
    endTime: z.date(),

    // Optional fields
    description: z
      .string()
      .max(2000, "Description must be less than 2000 characters")
      .optional(),
    location: z
      .string()
      .max(500, "Location must be less than 500 characters")
      .optional(),
    isAllDay: z.boolean().default(false),
    timezone: z.string().default("UTC").optional(),
    color: z
      .enum(["red", "orange", "blue", "green", "violet", "purple"])
      .default("blue"),
    category: z
      .string()
      .max(50, "Category must be less than 50 characters")
      .optional(),

    // Complex fields
    attendees: z.array(attendeeSchema).default([]),
    reminders: z.array(reminderSchema).default([]),
    isRecurring: z.boolean().default(false),
    recurrenceRule: recurrenceRuleSchema.optional(),

    // Status and visibility
    status: z
      .enum(["confirmed", "tentative", "cancelled"])
      .default("confirmed"),
    visibility: z.enum(["private", "public", "shared"]).default("private"),

    // AI integration
    threadId: z.uuid().optional(),
    agentId: z.uuid().optional(),
    aiContext: aiContextSchema.optional(),

    // External sync
    externalId: z.string().optional(),
    externalSource: z.enum(["google", "outlook", "apple"]).optional(),
  })
  .refine(
    (data) => {
      // Skip validation for all-day events (they can have same start/end time)
      if (data.isAllDay) return true

      // Validate that end time is after start time for timed events
      return new Date(data.endTime) > new Date(data.startTime)
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    },
  )
// .refine(
//   (data) => {
//     // Validate that start time is not in the past (unless it's an all-day event)
//     if (data.isAllDay) return true
//     const now = new Date()
//     return data.startTime >= now
//   },
//   {
//     message: "Start time cannot be in the past",
//     path: ["startTime"],
//   },
// )
// .refine(
//   (data) => {
//     // Validate event duration (max 24 hours for non-all-day events)
//     if (data.isAllDay) return true
//     const durationMs =
//       new Date(data.endTime).getTime() - new Date(data.startTime).getTime()
//     const maxDurationMs = 24 * 60 * 60 * 1000 // 24 hours
//     return durationMs <= maxDurationMs
//   },
//   {
//     message: "Event duration cannot exceed 24 hours",
//     path: ["endTime"],
//   },
// )

// Update calendar event schema - extends create schema with id field
// All fields from create schema become optional for updates
export const updateCalendarEventSchema = createCalendarEventSchema
  .partial() // Make all fields optional
  .extend({
    id: z.uuid("Invalid event ID"), // Add required id field
  })
  .refine(
    (data) => {
      // Skip validation for all-day events
      if (data.isAllDay) return true

      // Only validate time relationship if both are provided
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime)
      }
      return true
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    },
  )

// Delete calendar event schema

// Query parameters schema for GET requests
export const getCalendarEventsSchema = z.object({
  startDate: z
    .union([
      z
        .string()
        .datetime("Invalid start time format")
        .transform((str) => new Date(str)),
      z.date(),
    ])
    .pipe(z.date())
    .optional(),
  endDate: z
    .union([
      z
        .string()
        .datetime("Invalid end time format")
        .transform((str) => new Date(str)),
      z.date(),
    ])
    .pipe(z.date())
    .optional(),
  category: z.string().optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
})

// Create a form-specific schema that ensures Date types for react-hook-form
export const formCalendarEventSchema = createCalendarEventSchema.transform(
  (data) => ({
    ...data,
    startTime:
      data.startTime instanceof Date
        ? data.startTime
        : new Date(data.startTime),
    endTime:
      data.endTime instanceof Date ? data.endTime : new Date(data.endTime),
  }),
)

// Type exports
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>
export type FormCalendarEventInput = z.infer<typeof formCalendarEventSchema>
export type GetCalendarEventsInput = z.infer<typeof getCalendarEventsSchema>
