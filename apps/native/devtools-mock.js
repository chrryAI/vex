// Mock react-devtools-core to prevent EventTarget errors in Hermes
// This provides no-op implementations of all devtools functions

module.exports = {
  connectToDevTools: () => {},
  initialize: () => {},
  connectToWSBasedReactDevToolsFrontend: () => {},
  // Add any other devtools exports as no-ops
}
