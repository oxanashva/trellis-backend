import Cryptr from 'cryptr'
import bcrypt from 'bcrypt'

import { userService } from '../user/user.service.js'
import { logger } from '../../services/logger.service.js'

const isProd = process.env.NODE_ENV === 'production'

if (isProd && !process.env.SECRET) {
	console.error("CRITICAL: SECRET is not set in your .env file!")
	process.exit(1)
}

const cryptr = isProd ? new Cryptr(process.env.SECRET) : new Cryptr("QWE-123")

export const authService = {
	signup,
	login,
	getLoginToken,
	validateToken,
}

async function login(username, password) {
	logger.debug('auth.service - login attempt')

	const user = await userService.getByUsername(username)
	if (!user) return Promise.reject('Invalid username or password')

	const match = await bcrypt.compare(password, user.password)
	if (!match) return Promise.reject('Invalid username or password')

	delete user.password
	user._id = user._id.toString()
	return user
}

async function signup({ username, password, fullname, imgUrl, isAdmin }) {
	const saltRounds = 10

	logger.debug('auth.service - signup attempt')
	if (!username || !password || !fullname) return Promise.reject('Missing required signup information')

	const userExist = await userService.getByUsername(username)
	if (userExist) return Promise.reject('Username already taken')

	const hash = await bcrypt.hash(password, saltRounds)
	return userService.add({ username, password: hash, fullname, imgUrl, isAdmin })
}

function getLoginToken(user) {
	const userInfo = {
		_id: user._id,
		fullname: user.fullname,
		score: user.score,
		isAdmin: user.isAdmin,
	}
	return cryptr.encrypt(JSON.stringify(userInfo))
}

function validateToken(loginToken) {
	try {
		const json = cryptr.decrypt(loginToken)
		const loggedinUser = JSON.parse(json)
		return loggedinUser
	} catch (err) {
		logger.warn('Invalid login token detected')
	}
	return null
}
