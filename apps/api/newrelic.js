/**
 * New Relic agent configuration for API.
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || "Vex API"],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: {
    enabled: true,
  },
  logging: {
    level: process.env.NODE_ENV === "production" ? "info" : "trace",
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      "request.headers.cookie",
      "request.headers.authorization",
      "request.headers.proxyAuthorization",
      "request.headers.setCookie*",
      "request.headers.x*",
      "response.headers.cookie",
      "response.headers.authorization",
      "response.headers.proxyAuthorization",
      "response.headers.setCookie*",
      "response.headers.x*",
    ],
  },
  ai_monitoring: {
    enabled: true,
    streaming: {
      enabled: true,
    },
  },
}
