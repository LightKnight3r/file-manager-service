const _ = require('lodash')
const config = require('config')
const redis = require('redis')

let connections = {}

class RedisConnection {
  constructor(name, options) {
    this.connection = null
    this.options = options
    this.name = name

    this.init()
  }

  init() {
    this.connection = redis.createClient(this.options)

    this.connection.on('connect', () => {
      logger.logInfo(`[REDIS-${this.name}] - CONNECTED`)
    })

    this.connection.on('error', (err) => {
      logger.logError(`[REDIS-${this.name}]`, err)
    })
    this.connection.on('ready', (err) => {
      logger.logInfo(`[REDIS-${this.name}] - READY`)
      setInterval(() => {
        this.connection.ping((err,data) => {
          if (err) console.error('Redis keepalive error', err);
        });
      }, 30000);
    })
  }

  getConnection() {
    return this.connection
  }
}

function setUp() {
  const redisConfig = _.get(config, 'redis.connections', {})
  Object.keys(redisConfig).forEach((name) => {
    connections[name] = new RedisConnection(name, redisConfig[name])
  })
}

setUp()

module.exports = (name) => {
  return connections[name] || null
}
