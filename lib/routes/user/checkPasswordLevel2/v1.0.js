const _ = require('lodash')
const async = require('async')
const ms = require('ms')
const { v4: uuidv4 } = require('uuid');
const config = require('config')
const util = require('util')
const rp = require('request-promise');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const redisConnection = require('../../../connections/redis')
const User = require('../../../models/user')
const SystemLog = require('../../../models/systemLog')
const CONSTANTS = require('../../../const')
const MESSAGES = require('../../../message')


module.exports = (req, res) => {

  const userId = req.user.id || '';
  const passwordLevel2 = req.body.passwordLevel2 || '';

  const checkParams = (next) => {

    if(!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      });
    }

    if(!passwordLevel2 || (passwordLevel2 && !passwordLevel2.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          'head': 'Thông báo',
          'body': 'Vui lòng nhập mật khẩu'
        }
      });
    }

    // Kiểm tra mật khẩu có 6 số
    const passwordLevel2Pattern = /^\d{6}$/;
    if(!passwordLevel2Pattern.test(passwordLevel2.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          'head': 'Thông báo',
          'body': 'Mật khẩu phải là 6 chữ số'
        }
      });
    }

    next();
  }

  const checkWrongAttempts = (next) => {
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

        // Kiểm tra số lần nhập sai
        if(result.countWrongPassLevel2 >= 5) {
          User
            .updateOne({
              _id: userId,
              status: 1
            },{
              status: 0
            }, () => {});
          let stringToken = 'user'

          redisConnection('master').getConnection().get(`${stringToken}:${userId}`, (err, token) => {
            if(token) {
              redisConnection('master').getConnection().del([`${stringToken}:${token}`,`${stringToken}:${userId}`], (err, result) => {
              });
            }
          })

          return next({
            code: CONSTANTS.CODE.FAIL,
            message: {
              'head': 'Thông báo',
              'body': 'Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
            }
          })
        }

        next();
      })
  }

  const findUserAndCheckPassword = (next) => {
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

        // Kiểm tra xem user đã có mật khẩu chưa
        if(!result.passwordLevel2 || !result.activeLevel2) {
          return next({
            code: CONSTANTS.CODE.FAIL,
            message: {
              'head': 'Thông báo',
              'body': 'Tài khoản chưa thiết lập mật khẩu'
            }
          })
        }

        // So sánh mật khẩu
        bcrypt.compare(passwordLevel2.trim(), result.passwordLevel2, function(err, isMatch) {
          if(err) {
            return next(err);
          }

          if(!isMatch) {
            User
              .updateOne({
                _id: userId,
                activeLevel2: 1
              },{
                $inc: { countWrongPassLevel2: 1 }
              }, () => {});
            return next({
              code: CONSTANTS.CODE.FAIL,
              message: {
                'head': 'Thông báo',
                'body': 'Mật khẩu không chính xác, vui lòng thử lại'
              }
            })
          }
          User
            .updateOne({
              _id: userId,
              activeLevel2: 1
            },{
              countWrongPassLevel2: 0
            }, () => {});

          // Tạo JWT token với thời hạn 3 phút
          const payload = {
            userId: userId,
            level2Verified: true,
            iat: Math.floor(Date.now() / 1000)
          };

          const jwtSecret = config.secretKey || 'default-secret-key';
          const token = jwt.sign(payload, jwtSecret, { 
            expiresIn: '3m' // 3 phút
          });

          next(null,{
            code: CONSTANTS.CODE.SUCCESS,
            data: {
              token: token,
              expiresIn: 180 // 3 phút tính bằng giây
            }
          });
        });
      })
  }


  async.waterfall([
    checkParams,
    checkWrongAttempts,
    findUserAndCheckPassword,
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