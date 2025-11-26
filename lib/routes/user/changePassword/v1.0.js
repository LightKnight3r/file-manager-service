const _ = require('lodash')
const async = require('async')
const ms = require('ms')
const { v4: uuidv4 } = require('uuid');
const config = require('config')
const util = require('util')
const rp = require('request-promise');
const bcrypt = require('bcryptjs')

const redisConnection = require('../../../connections/redis')
const User = require('../../../models/user')
const SystemLog = require('../../../models/systemLog')
const CONSTANTS = require('../../../const')
const MESSAGES = require('../../../message')


module.exports = (req, res) => {

  const userId = req.user.id || '';
  const password = req.body.password || '';
  const newPassword = req.body.newPassword || '';
  const rePassword = req.body.rePassword || '';

  let passwordEncrypt

  const checkParams = (next) => {

    if(!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      });
    }

    if(!password || (password && !password.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.INVALID_PASSWORD
      });
    }

    if(!newPassword || (newPassword && !newPassword.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.INVALID_NEW_PASSWORD
      });
    }

    if(!rePassword || (rePassword && !rePassword.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.INVALID_REPASSWORD
      });
    }

    if(rePassword.trim() !== newPassword.trim()) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.PASSWORD_NOT_SAME
      });
    }

    next();
  }

  const findUser = (next) => {
    User
      .findById(userId)
      .lean()
      .exec((err, result) => {
        if(err) {
          return next(err);
        }
        if(!result) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: MESSAGES.SYSTEM.ERROR
          })
        }
        bcrypt.compare(password.trim(), result.password, function(err, res) {
          if(err) {
            return next(err);
          }

          if(!res) {
            return next({
              code: CONSTANTS.CODE.FAIL,
              message: {
                'head': 'Thông báo',
                'body': 'Mật khẩu không chính xác, vui lòng thử lại. Xin cảm ơn.'
              }
            })
          }
          if(password.trim() === newPassword.trim()) {
            return next({
              code: CONSTANTS.CODE.WRONG_PARAMS,
              message: MESSAGES.USER.PASSWORD_SAME
            });
          }
          next();
        });
      })
  }

  const encryptPassword = (next) => {
    bcrypt.hash(newPassword.trim(), 10, function(err, hash) {
        if(err) {
          return next(err);
        }

        passwordEncrypt = hash;
        next();
      });
  }

  const updatePassword = (next) => {
    User
      .update({
        _id: userId
      },{
        password: passwordEncrypt,
        active: 1
      },(err, result) => {
        if(err){
          return next(err)
        }
        next();
      })
  }

  const writeLog = (next) => {
    next(null,{
      code: CONSTANTS.CODE.SUCCESS,
      message: MESSAGES.USER.CHANGE_PASSWORD_SUCCESS,
    })
    SystemLog
      .create({
        user: userId,
        action: 'doi_mk',
        description: 'Đổi mật khẩu'
      },() =>{})
  }

  async.waterfall([
    checkParams,
    findUser,
    encryptPassword,
    updatePassword,
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