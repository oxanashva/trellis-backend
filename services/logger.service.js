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
    return {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        // Backend-relevant fields
        code: err.code,
        status: err.status,
    }
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
    new winston.transports.Console({ format: jsonFormat }),
]

// Only add Elasticsearch transport when the URL is configured.
// Prevents startup failures in local dev environments without ES running.
if (process.env.ELASTICSEARCH_URL) {
    transports.push(new ElasticsearchTransport({
        level: 'info', // never ship debug noise to ES even in dev
        clientOpts: { node: process.env.ELASTICSEARCH_URL },
        indexPrefix: 'trellis-logs',
        ensureMappingTemplate: true,
    }))
}

// Only add Loki transport when credentials are configured (Render / production).
// Falls back to console-only in local dev where these vars are not set.
if (process.env.LOKI_URL && process.env.LOKI_USER && process.env.LOKI_PASSWORD) {
    transports.push(new LokiTransport({
        host: process.env.LOKI_URL,
        basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_PASSWORD}`,
        labels: { app: 'trellis', env: process.env.NODE_ENV || 'development' },
        json: true,
        batching: true,
        interval: 5, // flush batch every 5 seconds
        replaceTimestamp: true, // use winston's timestamp, not Loki's ingest timestamp
        onConnectionError: (err) => {
            console.error('LOKI CONNECTION ERROR:', err.message)
        }
    }))
}

const winstonLogger = winston.createLogger({
    level: logLevel,
    transports,
})

function doLog(level, ...args) {
    const store = asyncLocalStorage.getStore() || {}
    const { requestId, loggedinUser } = store

    const logObject = {
        service: 'backend',
        requestId,
        userId: loggedinUser?._id,
    }

    // The first string is the message.
    const firstStringIndex = args.findIndex(arg => typeof arg === 'string')
    if (firstStringIndex !== -1) {
        logObject.message = args.splice(firstStringIndex, 1)[0]
    }

    // Any error object is pulled out. winston.format.errors() will handle it.
    const errorIndex = args.findIndex(isError)
    if (errorIndex !== -1) {
        logObject.error = args.splice(errorIndex, 1)[0]
    }

    // Merge remaining objects into a 'details' property after sanitizing.
    if (args.length) {
        const details = args.length > 1 ? args : args[0]
        logObject.details = sanitize(details)
    }

    winstonLogger.log(level, logObject)
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
