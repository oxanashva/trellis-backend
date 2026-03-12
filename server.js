import http from 'http'
import path from 'path'
import cors from 'cors'
import express from 'express'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'

import { authRoutes } from './api/auth/auth.routes.js'
import { userRoutes } from './api/user/user.routes.js'
import { reviewRoutes } from './api/review/review.routes.js'
import { boardRoutes } from './api/board/board.routes.js'
import { setupSocketAPI } from './services/socket.service.js'
import { setupAsyncLocalStorage } from './middlewares/setupAls.middleware.js'
import { logger } from './services/logger.service.js'
import { asyncLocalStorage } from './services/als.service.js'
import { log } from './middlewares/logger.middleware.js'

const app = express()
const server = http.createServer(app)

// Core middleware
app.use(cookieParser())
app.use(express.json())

const isProd = process.env.NODE_ENV === 'production'

if (isProd && !process.env.FRONTEND_URL) {
    console.error("CRITICAL: FRONTEND_URL is not set in your .env file!")
    process.exit(1)
}

const allowedOrigins = isProd
    ? [process.env.FRONTEND_URL] // ONLY your Render URL in production
    : [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
    ]

const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
}

app.use(cors(corsOptions))

// // Re-enable static serving if we merge the frontend into the backend service. Currently, the frontend is hosted as a separate 'Static Site' service on Render, so the backend does not need to serve these files.
// if (process.env.NODE_ENV === 'production') {
//     app.use(express.static(path.resolve('public')))
// }

// Inject logged-in user into AsyncLocalStorage for every request
app.all('/*all', setupAsyncLocalStorage)
// Log every request
app.all('/*all', log)

// Rate-limit the frontend log-forwarding endpoint.
// 20 requests per minute per IP prevents log-injection
const logRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
})

app.post('/api/log', logRateLimit, (req, res) => {
    const { level, message, ...meta } = req.body
    if (typeof message !== 'string') return res.status(400).end()
    logger.logFrontend(level, message.slice(0, 2000), meta)
    res.end()
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/review', reviewRoutes)
app.use('/api/board', boardRoutes)

setupSocketAPI(server)

// SPA fallback — serves index.html for any non-API GET (client-side routing)
app.get('/*all', (req, res) => {
    res.sendFile(path.resolve('public/index.html'))
})

// Centralized error handler — must be registered last, after all routes.
// Catches any error passed to next(err) from route handlers.
// Never leaks stack traces or internal details to the client in production.
app.use((err, req, res, next) => {
    logger.error('Unhandled server error', err)
    const { requestId } = asyncLocalStorage.getStore() || {}
    const isDev = process.env.NODE_ENV !== 'production'
    res.status(err.status || 500).json({
        error: isDev ? err.message : 'An unexpected error occurred',
        requestId,
    })
})

// Use server.listen (not app.listen) so Express and Socket.io share the same underlying http.Server instance.
const port = process.env.PORT || 3030
server.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running on port ${port}`)
})
