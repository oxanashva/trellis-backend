import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import LokiTransport from 'winston-loki'
import { asyncLocalStorage } from './als.service.js'

// Keys whose values must never appear in logs
const SENSITIVE_KEYS = new Set([
    'password', 'newpassword', 'confirmpassword',
    'token', 'secret', 'authorization', 'cookie',
])

function sanitizeMeta(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(sanitizeMeta)
    }

    // Handle Objects
    return Object.keys(obj).reduce((acc, key) => {
        const value = obj[key]

        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            acc[key] = '[REDACTED]'
        } else if (typeof value === 'object' && value !== null) {
            // Recurse into nested objects or arrays
            acc[key] = sanitizeMeta(value)
        } else {
            acc[key] = value
        }

        return acc
    }, {})
}

// Structured JSON format so every field is queryable in Kibana
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
if (process.env.LOKI_URL) {
    transports.push(new LokiTransport({
        host: process.env.LOKI_URL,
        basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_PASSWORD}`,
        labels: { app: 'trellis', env: process.env.NODE_ENV || 'development' },
        json: true,
        batching: true,
        interval: 5,           // flush batch every 5 seconds
        replaceTimestamp: true,        // use winston's timestamp, not Loki's ingest timestamp
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

    const message = args
        .map(arg => typeof arg === 'string' || _isError(arg) ? arg : JSON.stringify(sanitizeMeta(arg)))
        .join(' | ')

    winstonLogger.log(level, message, {
        service: 'backend',
        requestId,           // correlates all log lines for a single request
        userId: loggedinUser?._id,
    })
}

export const logger = {
    debug: (...args) => doLog('debug', ...args),
    info: (...args) => doLog('info', ...args),
    warn: (...args) => doLog('warn', ...args),
    error: (...args) => doLog('error', ...args),

    // Accepts log entries forwarded from the browser via POST /api/log
    logFrontend: (level, message, meta = {}) => {
        const safeLevel = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info'
        winstonLogger.log(safeLevel, message, { ...sanitizeMeta(meta), service: 'frontend' })
    },
}

function _isError(e) { return e && e.stack && e.message }
