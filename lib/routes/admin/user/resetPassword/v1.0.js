const _ = require('lodash');
const async = require('async');
const config = require('config');
const bcrypt = require('bcryptjs');
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const redisConnection = require('../../../../connections/redis');

module.exports = (req, res) => {
  const { _id } = req.body || '';
  const password = config.passwordDefault;
  const passwordLevel2 = config.passwordLevel2Default || password;
  let passwordHash;
  let passwordLevel2Hash;
  let updatedUser;

  const checkParams = (next) => {
    if (!_id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS || 'ID người dùng không được để trống',
      });
    }
    next(null);
  };

  const checkUserExists = (next) => {
    User.findById(_id)
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        if (!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: MESSAGES.USER.NOT_EXISTS || 'Người dùng không tồn tại',
          });
        }
        if (result.status === 0) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: MESSAGES.USER.INACTIVE || 'Người dùng đã bị vô hiệu hóa',
          });
        }
        next();
      });
  };

  const encryptPassword = (next) => {
    async.parallel([
      (callback) => {
        bcrypt.hash(password, 10, function (err, hash) {
          if (err) {
            return callback(err);
          }
          passwordHash = hash;
          callback();
        });
      },
      (callback) => {
        bcrypt.hash(passwordLevel2, 10, function (err, hash) {
          if (err) {
            return callback(err);
          }
          passwordLevel2Hash = hash;
          callback();
        });
      }
    ], (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  };

  const resetPassword = (next) => {
    User.findOneAndUpdate(
      { 
        _id,
        status: 1 
      },
      {
        password: passwordHash,
        passwordLevel2: passwordLevel2Hash,
        active: 0,
        activeLevel2: 0,
        lastTimeChangePass: Date.now(),
        lastTimeChangePassLevel2: Date.now(),
        countWrongPassLevel2: 0,
        updatedAt: Date.now()
      },
      { new: true }
    )
      .select('-password -passwordLevel2')
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        if (!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa'
            }
          });
        }
        updatedUser = result;
        next();
      });
  };

  const clearUserSessions = (next) => {
    // Xóa tất cả session của user trong Redis
    redisConnection('master').getConnection().get(`user:${_id}`, (err, token) => {
      if (token) {
        redisConnection('master').getConnection().del([`user:${token}`, `user:${_id}`], (err, result) => {
          // Session đã được xóa
        });
      }
      next(null);
    });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: {
        _id: updatedUser._id,
        username: updatedUser.username,
        name: updatedUser.name,
        active: updatedUser.active,
        activeLevel2: updatedUser.activeLevel2
      },
      message: {
        head: 'Thông báo',
        body: 'Reset mật khẩu và mật khẩu cấp 2 thành công',
      },
    });
  };

  async.waterfall([
    checkParams,
    checkUserExists,
    encryptPassword,
    resetPassword,
    clearUserSessions,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Reset password error:', err);
    }

    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR || 'Lỗi hệ thống',
    });

    res.json(data || err);
  });
};