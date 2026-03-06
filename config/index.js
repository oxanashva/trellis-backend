import configProd from './prod.js'
import configDev from './dev.js'

const isProduction = process.env.NODE_ENV === 'production'
const useLocalDb = process.env.LOCAL_DB !== 'false'

export var config

if (isProduction || !useLocalDb) {
    config = configProd
} else {
    config = configDev
}