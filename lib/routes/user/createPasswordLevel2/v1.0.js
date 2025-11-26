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
  const newPasswordLevel2 = req.body.newPasswordLevel2 || '';
  const rePasswordLevel2 = req.body.rePasswordLevel2 || '';

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

    if(!newPasswordLevel2 || (newPasswordLevel2 && !newPasswordLevel2.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.INVALID_NEW_PASSWORD
      });
    }

    if(!rePasswordLevel2 || (rePasswordLevel2 && !rePasswordLevel2.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.INVALID_REPASSWORD
      });
    }

    // Kiểm tra mật khẩu cấp 2 có 6 số
    const passwordLevel2Pattern = /^\d{6}$/;
    if(!passwordLevel2Pattern.test(newPasswordLevel2.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          'head': 'Thông báo',
          'body': 'Mật khẩu cấp 2 phải là 6 chữ số'
        }
      });
    }

    if(rePasswordLevel2.trim() !== newPasswordLevel2.trim()) {
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
          
          // Kiểm tra mật khẩu đăng nhập không được trùng với mật khẩu cấp 2
          if(password.trim() === newPasswordLevel2.trim()) {
            return next({
              code: CONSTANTS.CODE.WRONG_PARAMS,
              message: {
                'head': 'Thông báo',
                'body': 'Mật khẩu cấp 2 không được trùng với mật khẩu đăng nhập'
              }
            });
          }
          
          next();
        });
      })
  }

  const encryptPassword = (next) => {
    bcrypt.hash(newPasswordLevel2.trim(), 10, function(err, hash) {
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
        passwordLevel2: passwordEncrypt,
        activeLevel2: 1,
        lastTimeChangePassLevel2: new Date()
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
      message: {
        'head': 'Thông báo',
        'body': 'Tạo mật khẩu cấp 2 thành công'
      }
    })
    SystemLog
      .create({
        user: userId,
        action: 'tao_mk_cap2',
        description: 'Tạo mật khẩu cấp 2'
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