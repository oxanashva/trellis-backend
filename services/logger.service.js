import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import LokiTransport from 'winston-loki'
import { asyncLocalStorage } from './als.service.js'
import { sanitize, parseLogArgs } from './logger.shared.js'

const isDev     = process.env.NODE_ENV !== 'production'
const logLevel  = isDev ? 'debug' : 'info'

// ---------------------------------------------------------------------------
// Winston transports
// ---------------------------------------------------------------------------

// Structured JSON format — every field queryable in Kibana / Grafana
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
)

const transports = [
    new winston.transports.Console(),
]

// Only add Elasticsearch transport when the URL is configured.
// Prevents startup failures in local dev environments without ES running.
if (process.env.ELASTICSEARCH_URL) {
    transports.push(new ElasticsearchTransport({
        level:                logLevel,
        clientOpts:           { node: process.env.ELASTICSEARCH_URL },
        indexPrefix:          'trellis-logs',
        ensureMappingTemplate: true,
    }))
}

// Only add Loki transport when credentials are configured (Render / production).
// Falls back to console-only in local dev where these vars are not set.
if (process.env.LOKI_URL && process.env.LOKI_USER && process.env.LOKI_PASSWORD) {
    const lokiTransport = new LokiTransport({
        level:     logLevel,
        host:      process.env.LOKI_URL,
        basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_PASSWORD}`,
        labels:    { app: 'trellis', env: process.env.NODE_ENV || 'development' },
        // Providing a format sets useCustomFormat=true inside winston-loki.
        // Without it, winston-loki builds the log line as `"${message} ${JSON.stringify(rest)}"` —
        // plain text, not JSON. With a format it uses info[MESSAGE] set by json(), which IS JSON.
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        json:             true,
        batching:         true,
        interval:         5,
        replaceTimestamp: true,
        onConnectionError: (err) => console.error('[LOKI] Connection error:', err.message),
    })
    lokiTransport.on('error', (err) => {
        // Catch HTTP-level errors that onConnectionError does not surface
        console.error('[LOKI] Transport error:', err?.message || err)
    })
    transports.push(lokiTransport)
}

const winstonLogger = winston.createLogger({
    level:  logLevel,
    format: jsonFormat,
    transports,
})

// ---------------------------------------------------------------------------
// Core log dispatcher
// ---------------------------------------------------------------------------

function doLog(level, ...args) {
    const { requestId, loggedinUser } = asyncLocalStorage.getStore() || {}
    const { message, errorFields, metaFields } = parseLogArgs(args, isDev)

    winstonLogger.log(level, message, {
        service:   'backend',
        requestId,
        // userId: loggedinUser?._id,   // uncomment when user context is needed
        ...errorFields,
        ...metaFields,
    })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Application logger backed by Winston.
 * Always writes to stdout (console transport). In production, also ships to
 * Elasticsearch (when ELASTICSEARCH_URL is set) and Grafana Loki (when
 * LOKI_URL / LOKI_USER / LOKI_PASSWORD are set).
 *
 * Every entry is automatically enriched with the current requestId from
 * AsyncLocalStorage, and sensitive metadata fields are redacted.
 *
 * Accepts the same variadic contract as the frontend logger:
 *   logger.info('message')
 *   logger.error('DB write failed', err)
 *   logger.warn('Slow query', err, { collectionName, durationMs })
 *
 * @example
 * logger.info('Board saved', { boardId: board._id })
 * logger.error('DB write failed', err, { boardId })
 */
export const logger = {
    debug: (...args) => doLog('debug', ...args),
    info:  (...args) => doLog('info',  ...args),
    warn:  (...args) => doLog('warn',  ...args),
    error: (...args) => doLog('error', ...args),

    /**
     * Receives a pre-parsed log event forwarded from the frontend `/log` endpoint.
     * Re-emits it through Winston so frontend logs flow into the same Loki stream
     * with `service: 'frontend'`, enriched with the backend's requestId.
     */
    logFrontend: (level, message, meta = {}) => {
        const safeLevel   = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info'
        const { requestId } = asyncLocalStorage.getStore() || {}

        winstonLogger.log(safeLevel, message, {
            ...sanitize(meta, isDev),
            service:   'frontend',
            requestId,
        })
    },
}
