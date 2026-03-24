import { logger } from '../services/logger.service.js'

export function log(req, res, next) {
    const startTime = Date.now()

    // Debug only — suppressed in production (log level is 'info' in prod)
    logger.debug('Incoming request', {
        method: req.method,
        url:    req.baseUrl + req.path,
        ip:     req.ip,
    })

    // Use res.on('finish') so logging happens after the response is fully sent.
    // All numeric values are converted to strings — Loki's structured metadata
    // spec requires string values; numeric values cause Loki to silently reject
    // the entire push request with a 400.
    res.on('finish', () => {
        logger.info('Request completed', {
            method:      req.method,
            url:         req.baseUrl + req.path,
            status_code: String(res.statusCode),
            duration_ms: String(Date.now() - startTime),
            ip:          req.ip,
        })
    })

    next()
}
