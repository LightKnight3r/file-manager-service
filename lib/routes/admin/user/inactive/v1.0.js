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
  const active = req.body.active || 0;

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
        next()
      })

  }

  const modifyUser = (next) => {
    User
      .findOneAndUpdate({
        _id: id,
        status: active ? 0 : 1
      },
      {
        status: active ? 1 : 0,
        updatedAt: Date.now()
      },
      {new: true}
      )
      .select('-password -passwordLevel2')
      .lean()
      .exec((err, result) => {
        if(err) {
          return next(err);
        }
        if(!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa'
            }
          });
        }
        updatedData = result;
        next(null);
      })
  }

  const updateRedisData = (next) => {
    if(active) {
      return next(null);
    }
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
      data: {
        _id: updatedData._id,
        username: updatedData.username,
        name: updatedData.name,
        status: updatedData.status,
        updatedAt: updatedData.updatedAt
      },
      message: {
        head: 'Thông báo',
        body: active ? 'Kích hoạt tài khoản thành công' : 'Vô hiệu hóa tài khoản thành công',
      },
    });
  };

  async.waterfall([
    checkParams,
    checkUserExists,
    modifyUser,
    updateRedisData,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Inactive user error:', err);
    }
    
    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR || {
        head: 'Thông báo',
        body: 'Lỗi hệ thống'
      }
    });

    res.json(data || err);
  })
}