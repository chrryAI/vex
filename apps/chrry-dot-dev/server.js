const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const EventEmitter = require('events')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3001

// Patch EventEmitter to suppress ECONNRESET errors globally
if (dev) {
  const originalEmit = EventEmitter.prototype.emit
  EventEmitter.prototype.emit = function (event, ...args) {
    if (event === 'error' && args[0]?.code === 'ECONNRESET') {
      // Silently ignore ECONNRESET errors
      return false
    }
    return originalEmit.apply(this, [event, ...args])
  }

  // Also catch uncaught exceptions
  process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNRESET') {
      return
    }
    console.error('Uncaught Exception:', err)
    process.exit(1)
  })
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Add error handlers immediately
      req.on('error', (err) => {
        if (err.code === 'ECONNRESET') return
        console.error('Request error:', err)
      })

      res.on('error', (err) => {
        if (err.code === 'ECONNRESET') return
        console.error('Response error:', err)
      })

      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      if (err.code === 'ECONNRESET') return
      console.error('Error occurred handling', req.url, err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('internal server error')
      }
    }
  })

  // Handle server-level errors
  server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) {
      return
    }
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  })

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
