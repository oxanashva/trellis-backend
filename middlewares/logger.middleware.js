import { logger } from '../services/logger.service.js'

export function log(req, res, next) {
    logger.info('Incoming request', {
        method: req.method,
        url: req.baseUrl + req.path,
        params: req.params,
        query: req.query,
        body: req.body,
        ip: req.ip,
    })
    next()
}
