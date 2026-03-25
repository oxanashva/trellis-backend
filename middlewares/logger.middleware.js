import { logger } from '../services/logger.service.js'

export function log(req, res, next) {
    const startTime = Date.now()

    res.on('finish', () => {
        const status = res.statusCode

        // Route pattern (e.g. /api/users/:id) instead of the raw URL
        // (e.g. /api/users/abc123). Raw URLs make every unique ID a distinct
        // log line — route patterns let Grafana aggregate by endpoint cleanly.
        // req.route is only set after Express matches a handler; fall back to
        // req.path so unmatched routes (404s) are still logged.
        const routePath = req.baseUrl + (req.route?.path ?? req.path)

        // All numeric values are stringified — Loki's structured metadata spec
        // requires string values; numbers cause Loki to silently reject the
        // entire push request with a 400.
        const meta = {
            method: req.method,
            path: routePath,
            status_code: String(status),
            response_time_ms: String(Date.now() - startTime),
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            content_length: res.getHeader('content-length')
                ? String(res.getHeader('content-length'))
                : undefined,
            // user_id is available here if auth middleware runs before this one
            // and attaches the decoded JWT to req.loggedinUser (or req.user).
            // Uncomment once auth middleware is wired up before log middleware.
            // user_id: req.loggedinUser?._id,
        }

        // Match the log level to the response outcome so Grafana alert rules
        // on level="error" catch both the route-level error log AND this
        // access log for the same request. Correlate the two via requestId.
        if (status >= 500) {
            logger.error('Request completed', meta)
        } else if (status >= 400) {
            logger.warn('Request completed', meta)
        } else {
            logger.info('Request completed', meta)
        }
    })

    next()
}
