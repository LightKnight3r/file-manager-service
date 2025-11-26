const _ = require('lodash')
const async = require('async')
const ms = require('ms')
const { v4: uuidv4 } = require('uuid');
const config = require('config')
const util = require('util')
const rp = require('request-promise');

const redisConnection = require('../../../connections/redis')
const CONSTANTS = require('../../../const')
const MESSAGES = require('../../../message')


module.exports = (req, res) => {

  const userId = req.user.id || '';
  let stringToken = 'user'

  const checkParams = (next) => {
    if(!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      });
    }

    next();
  }

  const logout = (next) => {
    next(null,{
      code: CONSTANTS.CODE.SUCCESS
    });

    redisConnection('master').getConnection().get(`${stringToken}:${userId}`, (err, token) => {
      if(token) {
        redisConnection('master').getConnection().del([`${stringToken}:${token}`,`${stringToken}:${userId}`], (err, result) => {
        });
      }
    })
  }



  async.waterfall([
    checkParams,
    logout
  ], (err, data) => {
    if (_.isError(err)) {
      logger.logError([err], req.originalUrl, req.body);
      MailUtil.sendMail(`${req.originalUrl} - ${err} - ${JSON.stringify(req.body)}`);
    }
    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR
    });

    res.json(data || err);
  })
}