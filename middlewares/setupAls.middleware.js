import { authService } from '../api/auth/auth.service.js'
import { asyncLocalStorage } from '../services/als.service.js'
import { randomUUID } from 'crypto'

export async function setupAsyncLocalStorage(req, res, next) {
	const storage = {}
	asyncLocalStorage.run(storage, () => {
		const alsStore = asyncLocalStorage.getStore()
		alsStore.requestId = randomUUID()

		if (!req.cookies?.loginToken) return next()
		const loggedinUser = authService.validateToken(req.cookies.loginToken)

		if (loggedinUser) {
			alsStore.loggedinUser = loggedinUser
		}
		next()
	})
}
