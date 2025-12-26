// Temporarily disabled pino logging - using native console
// TODO: Re-enable pino-pretty and axiom once logger initialization issues are resolved

// Simple pass-through to native console
export const logger = console

// No-op promise for compatibility
export const loggerPromise = Promise.resolve(console)

// Re-export console as-is
export { console }

export default logger
