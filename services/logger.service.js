import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import { asyncLocalStorage } from './als.service.js'

// Keys whose values must never appear in logs
const SENSITIVE_KEYS = new Set([
    'password', 'newpassword', 'confirmpassword',
    'token', 'secret', 'authorization', 'cookie',
])

function sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return meta
    return Object.fromEntries(
        Object.entries(meta).map(([k, v]) =>
            [k, SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v]
        )
    )
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
    info:  (...args) => doLog('info',  ...args),
    warn:  (...args) => doLog('warn',  ...args),
    error: (...args) => doLog('error', ...args),

    // Accepts log entries forwarded from the browser via POST /api/log
    logFrontend: (level, message, meta = {}) => {
        const safeLevel = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info'
        winstonLogger.log(safeLevel, message, { ...sanitizeMeta(meta), service: 'frontend' })
    },
}

function _isError(e) { return e && e.stack && e.message }
