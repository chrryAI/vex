// Suppress ECONNRESET errors before Next.js starts
const EventEmitter = require('events')

// Patch EventEmitter globally
const originalEmit = EventEmitter.prototype.emit
EventEmitter.prototype.emit = function (event, ...args) {
  const error = args[0]
  if (error?.code === 'ECONNRESET' || error?.code === 'EPIPE') {
    return false
  }
  return originalEmit.apply(this, [event, ...args])
}

// Catch process-level errors
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    return
  }
  console.error('Uncaught Exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  if (reason?.code === 'ECONNRESET' || reason?.code === 'EPIPE') {
    return
  }
  console.error('Unhandled Rejection:', reason)
})

// Now require Next.js
require('next/dist/bin/next')
