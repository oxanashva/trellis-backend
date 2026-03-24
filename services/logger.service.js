import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import LokiTransport from 'winston-loki'
import { asyncLocalStorage } from './als.service.js'

// Keys whose values must never appear in logs
const SENSITIVE_PATTERNS = [
    /password/i, /secret/i, /token/i,
    /apikey/i, /api_key/i,
    /cardnumber/i, /creditcard/i, /cvv/i, /pin/i,
    /ssn/i,
]

function isSensitiveKey(key) {
    return SENSITIVE_PATTERNS.some(p => p.test(key))
}

function serializeError(err) {
    const serialized = {
        name: err.name || 'Error',
        message: err.message || 'Unknown error',
    }

    // Only include stack if it exists and we're not in production
    if (err.stack && process.env.NODE_ENV !== 'production') {
        serialized.stack = err.stack
    }

    // Only include these fields if they exist
    if (err.code !== undefined) serialized.code = err.code
    if (err.status !== undefined) serialized.status = err.status
    if (err.statusCode !== undefined) serialized.statusCode = err.statusCode

    // Capture HTTP-specific error details (flat — nested objects break Loki)
    if (err.response) {
        serialized.response_status = err.response.status
        serialized.response_status_text = err.response.statusText
        if (err.response.data !== undefined) {
            serialized.response_data = JSON.stringify(sanitize(err.response.data))
        }
    }

    return serialized
}

export function sanitize(value) {
    if (value instanceof Error) return serializeError(value)  // must come before object check
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(sanitize)

    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
            k,
            isSensitiveKey(k) ? '[REDACTED]' : sanitize(v),
        ])
    )
}

// Structured JSON format so every field is queryable in Kibana/Grafana
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
)

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

const transports = [
    new winston.transports.Console(),
]

// Only add Elasticsearch transport when the URL is configured.
// Prevents startup failures in local dev environments without ES running.
if (process.env.ELASTICSEARCH_URL) {
    transports.push(new ElasticsearchTransport({
        level: logLevel, // never ship debug noise to ES even in dev
        clientOpts: { node: process.env.ELASTICSEARCH_URL },
        indexPrefix: 'trellis-logs',
        ensureMappingTemplate: true,
    }))
}

// Only add Loki transport when credentials are configured (Render / production).
// Falls back to console-only in local dev where these vars are not set.
if (process.env.LOKI_URL && process.env.LOKI_USER && process.env.LOKI_PASSWORD) {
    const lokiTransport = new LokiTransport({
        level: logLevel,
        host: process.env.LOKI_URL,
        basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_PASSWORD}`,
        labels: { app: 'trellis', env: process.env.NODE_ENV || 'development' },
        // Providing a format sets useCustomFormat=true inside winston-loki.
        // Without it, winston-loki builds the log line as `"${message} ${JSON.stringify(rest)}"` —
        // plain text, not JSON. With a format it uses info[MESSAGE] set by json(), which IS JSON.
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        json: true,
        batching: true,
        interval: 5,
        replaceTimestamp: true,
        onConnectionError: (err) => {
            console.error('[LOKI] Connection error:', err.message)
        },
    })
    // Catch HTTP-level errors that onConnectionError does not surface
    lokiTransport.on('error', (err) => {
        console.error('[LOKI] Transport error:', err?.message || err)
    })
    transports.push(lokiTransport)
}

const winstonLogger = winston.createLogger({
    level: logLevel,
    format: jsonFormat,
    transports,
})

function doLog(level, ...args) {
    const store = asyncLocalStorage.getStore() || {}
    const { requestId, loggedinUser } = store

    let message = ''
    const meta = {
        service: 'backend',
        requestId,
        // userId: loggedinUser?._id,
    }

    // The first string is the message.
    const firstStringIndex = args.findIndex(arg => typeof arg === 'string')
    if (firstStringIndex !== -1) {
        message = args.splice(firstStringIndex, 1)[0]
    }

    // Any error object is pulled out and flattened — nested objects break Loki.
    const errorIndex = args.findIndex(isError)
    if (errorIndex !== -1) {
        const err = args.splice(errorIndex, 1)[0]
        meta.error_name = err.name || 'Error'
        meta.error_message = err.message || 'Unknown error'
        if (err.stack && process.env.NODE_ENV !== 'production') {
            meta.error_stack = err.stack
        }
        if (err.status || err.statusCode) meta.error_status = String(err.status || err.statusCode)
        if (err.code) meta.error_code = String(err.code)
        // Capture HTTP error response details (e.g. from fetch/axios errors)
        if (err.response) {
            meta.error_response_status = String(err.response.status)
            meta.error_response_status_text = err.response.statusText
            if (err.response.data !== undefined) {
                meta.error_response_data = JSON.stringify(sanitize(err.response.data))
            }
        }
    }

    // Merge remaining objects directly into meta (flat) — avoids nested 'details' object.
    if (args.length) {
        const details = args.length > 1 ? args : args[0]
        const sanitized = sanitize(details)
        if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
            Object.assign(meta, sanitized)
        }
    }

    winstonLogger.log(level, message, meta)
}

/**
 * Application logger backed by Winston.
 * Always writes to stdout (console transport). In production, also ships to
 * Elasticsearch (when ELASTICSEARCH_URL is set) and Grafana Loki (when
 * LOKI_URL / LOKI_USER / LOKI_PASSWORD are set).
 *
 * Every entry is automatically enriched with the current requestId and userId
 * from AsyncLocalStorage, and sensitive metadata fields are redacted.
 *
 * @example
 * logger.info('Board saved', { boardId: board._id })
 * logger.error('DB write failed', err, { boardId })
 */
export const logger = {
    debug: (...args) => doLog('debug', ...args),
    info: (...args) => doLog('info', ...args),
    warn: (...args) => doLog('warn', ...args),
    error: (...args) => doLog('error', ...args),

    logFrontend: (level, message, meta = {}) => {
        const safeLevel = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info'

        const { requestId } = asyncLocalStorage.getStore() || {}
        winstonLogger.log(safeLevel, message, {
            ...sanitize(meta),
            service: 'frontend',
            requestId,
        })
    },
}

function isError(e) {
    if (typeof Error.isError === 'function') {
        return Error.isError(e)
    }
    return e instanceof Error || Object.prototype.toString.call(e) === '[object Error]'
}
