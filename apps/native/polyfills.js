// Polyfill EventTarget for Hermes compatibility
// This prevents "Cannot call a class as a function" errors from ES6 classes
if (typeof global.EventTarget === 'undefined') {
  global.EventTarget = function EventTarget() {
    this._listeners = {}
  }

  global.EventTarget.prototype.addEventListener = function(type, listener) {
    if (!this._listeners[type]) {
      this._listeners[type] = []
    }
    if (this._listeners[type].indexOf(listener) === -1) {
      this._listeners[type].push(listener)
    }
  }

  global.EventTarget.prototype.removeEventListener = function(type, listener) {
    if (!this._listeners[type]) return
    const index = this._listeners[type].indexOf(listener)
    if (index !== -1) {
      this._listeners[type].splice(index, 1)
    }
  }

  global.EventTarget.prototype.dispatchEvent = function(event) {
    if (!this._listeners[event.type]) return true
    const listeners = this._listeners[event.type].slice()
    for (let i = 0; i < listeners.length; i++) {
      listeners[i].call(this, event)
    }
    return !event.defaultPrevented
  }
}
