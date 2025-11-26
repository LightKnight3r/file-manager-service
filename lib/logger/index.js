const winston = require('winston')
const config = require('config')
const _ = require('lodash')
const fs = require('fs')

function setUp(dir) {
  fs.existsSync(dir) || fs.mkdirSync(dir)

  const logLevel = _.get(config, 'logLevel', 'info')

  const logger = new winston.Logger({
    levels: {
      info: 1,
      error: 0
    },
    colors: {
      info: 'green',
      error: 'red'
    },
    transports: [
      new (winston.transports.Console)({
        level: 'info',
        colorize: true
      }),
      new (require('winston-daily-rotate-file'))({
        level: 'error',
  			datePattern: 'dd-MM-yyyy',
  			filename: dir + '/system-',
  			json: false,
  			timestamp: function () {
          return (new Date()).toLocaleString()
        }
  		})
    ]
  })

  const obj = {
    logInfo: () => {},
    logError: (...args) => {
      logger.error(...args, {})
    }
  }

  if(logLevel === 'info') {
    obj.logInfo = (...args) => {
      logger.info(...args, {})
    }
  }

  return obj
}

module.exports = setUp
