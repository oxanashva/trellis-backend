import 'dotenv/config'

if (!process.env.DB_NAME) {
    console.error("CRITICAL: DB_NAME is not set in your .env file!")
    process.exit(1)
}
if (!process.env.MONGO_URL) {
    console.error("CRITICAL: MONGO_URL is not set in your .env file!")
    process.exit(1)
}

export default {
    dbURL: process.env.MONGO_URL,
    dbName: process.env.DB_NAME
}