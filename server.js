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

const app = express()
const server = http.createServer(app)

// Core middleware
app.use(cookieParser())
app.use(express.json())

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('public')))
} else {
    const corsOptions = {
        origin: [
            'http://127.0.0.1:3000',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://localhost:5173',
        ],
        credentials: true,
    }
    app.use(cors(corsOptions))
}

// Inject logged-in user into AsyncLocalStorage for every request
app.all('/*all', setupAsyncLocalStorage)

// Rate-limit the frontend log-forwarding endpoint.
// 20 requests per minute per IP prevents log-injection and ES flooding.
const logRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
})

app.post('/api/log', logRateLimit, (req, res) => {
    const { level, message } = req.body
    logger.logFrontend(level, message)
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
    const isDev = process.env.NODE_ENV !== 'production'
    res.status(err.status || 500).json({
        error: isDev ? err.message : 'An unexpected error occurred',
    })
})

// Use server.listen (not app.listen) so Express and Socket.io share the
// same underlying http.Server instance.
const port = process.env.PORT || 3030
server.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running on port ${port}`)
})
