const _ = require('lodash')
const async = require('async')
const ms = require('ms')
const { v4: uuidv4 } = require('uuid');
const config = require('config')
const util = require('util')
const rp = require('request-promise');
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi);

const User = require('../../../../models/user')
const CONSTANTS = require('../../../../const')
const MESSAGES = require('../../../../message')
const redisConnection = require('../../../../connections/redis')
const SystemLogModel = require('../../../../models/systemLog'); // Add SystemLogModel import

module.exports = (req, res) => {

  const {id} = req.body || ''
  let updatedData = {};

  const checkParams = (next) => {

    if(!id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      })
    }

    next(null);
  }

  const checkUserExists = (next) => {

    User
      .findById(id)
      .lean()
      .exec((err, result) => {
        if(err) {
          return next(err)
        }
        if(!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: MESSAGES.USER.NOT_EXISTS
          })
        }
        if(_.get(result, 'status') === 0) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: MESSAGES.USER.INACTIVE
          })
        }
        next()
      })

  }

  const modifyUser = (next) => {

    req.body.updatedAt = Date.now();

    User
      .findOneAndUpdate({
        _id: id
      },
      {status: 0},
      {new: true}
      )
      .lean()
      .exec((err, result) => {
        if(err || !result) {
          return next(err || new Error('Lỗi vô hiệu hóa tài khoản'));
        }
        updatedData = result;
        next(null);
      })

  }

  const updateRedisData = (next) => {
    redisConnection('master').getConnection().get(`user:${id}`, (err, token) => {
      if(token) {
        redisConnection('master').getConnection().del([`user:${token}`,`user:${id}`], (err, result) => {
        });
      }
      next(null);
    })

  }

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      message: {
        head: 'Thông báo',
        body: 'Vô hiệu hóa tài khoản thành công',
      },
    });

    SystemLogModel.create(
      {
        user: _.get(req,'user.id', ''),
        action: 'inactive_user',
        description: 'Vô hiệu hóa người dùng',
        data: req.body,
        updatedData,
      },
      () => {}
    );
  };

  async.waterfall([
    checkParams,
    checkUserExists,
    modifyUser,
    updateRedisData,
    writeLog
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