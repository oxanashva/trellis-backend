import { randomUUID } from 'crypto'
import { asyncLocalStorage } from '../services/als.service.js'
import { logger } from '../services/logger.service.js'

// Keys whose values must be redacted before a request body reaches any log
const SENSITIVE_BODY_KEYS = new Set([
    'password', 'newPassword', 'confirmPassword', 'token', 'secret',
])

function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body
    return Object.fromEntries(
        Object.entries(body).map(([k, v]) =>
            [k, SENSITIVE_BODY_KEYS.has(k) ? '[REDACTED]' : v]
        )
    )
}

export function log(req, res, next) {
    // Attach a unique ID to the ALS store for this request so every log line
    // produced during the request lifecycle can be correlated in Kibana.
    const store = asyncLocalStorage.getStore()
    if (store) store.requestId = randomUUID()

    logger.info('Incoming request', {
        method: req.method,
        url:    req.baseUrl + req.path,
        params: req.params,
        body:   sanitizeBody(req.body),
        ip:     req.ip,
    })
    next()
}
