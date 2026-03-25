/**
 * logger.shared.js
 *
 * Pure utilities shared between the frontend and backend loggers.
 * No environment-specific imports — safe to bundle on either side.
 */

// ---------------------------------------------------------------------------
// Sensitive key detection
// ---------------------------------------------------------------------------

export const SENSITIVE_PATTERNS = [
    /password/i, /secret/i, /token/i,
    /apikey/i, /api_key/i,
    /cardnumber/i, /creditcard/i, /cvv/i, /pin/i,
    /ssn/i,
]

export function isSensitiveKey(key) {
    return SENSITIVE_PATTERNS.some(p => p.test(key))
}

// ---------------------------------------------------------------------------
// Error detection
// ---------------------------------------------------------------------------

/**
 * Cross-realm error check.
 * `instanceof Error` fails when the error originates from a different JS realm
 * (e.g. across iframes, certain bundler boundaries, or vm contexts).
 * The toString fallback handles those cases.
 */
export function isError(e) {
    if (typeof Error.isError === 'function') return Error.isError(e) // ES2026+
    return e instanceof Error || Object.prototype.toString.call(e) === '[object Error]'
}

// ---------------------------------------------------------------------------
// Error serialisation
// ---------------------------------------------------------------------------

/**
 * Flattens an error into a plain object with Loki-compatible snake_case keys.
 * Nested objects are avoided deliberately — Loki indexes flat key-value pairs;
 * deep nesting silently truncates fields.
 *
 * Works for:
 *  - Plain `Error` / `TypeError` / `RangeError` etc.
 *  - Axios errors (`err.response`, `err.config`, `err.code`)
 *  - Fetch-wrapper errors that follow the same shape
 *  - Node.js system errors (`err.code`, `err.syscall`, `err.path`)
 *
 * @param {Error} err
 * @param {boolean} isDev  When false, stack is omitted (never ship to production logs)
 * @returns {Record<string, string | number | undefined>}
 */
export function serializeError(err, isDev) {
    const out = {
        error_name:    err.name    || 'Error',
        error_message: err.message || 'Unknown error',
    }

    if (isDev && err.stack) {
        out.error_stack = err.stack
    }

    // Generic code (e.g. 'ECONNREFUSED', 'ERR_NETWORK', Axios codes)
    if (err.code    !== undefined) out.error_code       = String(err.code)
    // Express/http-errors style: .status is the canonical field
    if (err.status  !== undefined) out.error_status     = String(err.status)
    // Some libraries still use .statusCode (Node http.IncomingMessage)
    if (err.statusCode !== undefined && err.status === undefined) {
        out.error_status = String(err.statusCode)
    }

    // Node.js syscall errors
    if (err.syscall !== undefined) out.error_syscall = String(err.syscall)
    if (err.path    !== undefined) out.error_path    = String(err.path)

    // HTTP response details (Axios / fetch wrappers)
    if (err.response) {
        out.error_response_status = String(err.response.status)
        if (err.response.statusText) {
            out.error_response_status_text = err.response.statusText
        }
        if (err.response.data !== undefined) {
            // sanitize before stringifying so secrets in error bodies are redacted
            out.error_response_data = JSON.stringify(sanitize(err.response.data))
        }
    }

    return out
}

// ---------------------------------------------------------------------------
// Deep sanitiser
// ---------------------------------------------------------------------------

/**
 * Recursively walks a value and:
 *  1. Serialises Error instances via `serializeError` (must run before the
 *     generic object branch, because Error IS an object).
 *  2. Redacts values whose key matches SENSITIVE_PATTERNS.
 *  3. Maps arrays element-by-element.
 *  4. Returns primitives as-is.
 *
 * `isDev` is threaded through so serializeError can decide whether to include
 * stack traces without needing access to env globals here.
 *
 * @param {unknown} value
 * @param {boolean} isDev
 * @returns {unknown}
 */
export function sanitize(value, isDev = false) {
    if (isError(value))                       return serializeError(value, isDev)
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value))                 return value.map(v => sanitize(v, isDev))

    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
            k,
            isSensitiveKey(k) ? '[REDACTED]' : sanitize(v, isDev),
        ])
    )
}

// ---------------------------------------------------------------------------
// Argument normaliser  (shared doLog contract)
// ---------------------------------------------------------------------------

/**
 * Parses the variadic args that both frontend and backend loggers accept:
 *
 *   logger.info('message')
 *   logger.error('message', err)
 *   logger.info('message', { meta: 'fields' })
 *   logger.error('message', err, { extra: 'context' })
 *
 * Returns `{ message, errorFields, metaFields }` — all flat, Loki-safe.
 * Callers merge these into their own base meta object.
 *
 * @param {unknown[]} args
 * @param {boolean}   isDev
 * @returns {{ message: string, errorFields: object, metaFields: object }}
 */
export function parseLogArgs(args, isDev) {
    const remaining = [...args]
    let message = ''
    const errorFields = {}
    const metaFields  = {}

    // First string argument becomes the message
    const strIdx = remaining.findIndex(a => typeof a === 'string')
    if (strIdx !== -1) {
        message = remaining.splice(strIdx, 1)[0]
    }

    // First Error argument is flattened into errorFields
    const errIdx = remaining.findIndex(isError)
    if (errIdx !== -1) {
        const err = remaining.splice(errIdx, 1)[0]
        Object.assign(errorFields, serializeError(err, isDev))
    }

    // Remaining objects are merged into metaFields (arrays are dropped — not Loki-safe)
    for (const arg of remaining) {
        if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
            Object.assign(metaFields, sanitize(arg, isDev))
        }
    }

    return { message, errorFields, metaFields }
}
