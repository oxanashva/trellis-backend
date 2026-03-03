import configProd from './prod.js'
import configDev from './dev.js'

export var config
if (process.env.NODE_ENV === 'production' || process.env.LOCAL_DB === 'false') {
    config = configProd
} else {
    config = configDev
}