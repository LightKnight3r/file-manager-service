const _ = require('lodash');
const async = require('async');
const config = require('config');
const bcrypt = require('bcryptjs');
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const redisConnection = require('../../../../connections/redis');
const SystemLogModel = require('../../../../models/systemLog');

module.exports = (req, res) => {
  const { _id } = req.body || '';
  const password = config.passwordDefault;
  let passwordHash;
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
    bcrypt.hash(password, 10, function (err, hash) {
      if (err) {
        return next(err);
      }
      passwordHash = hash;
      next();
    });
  };

  const resetPassword = (next) => {
    User.findOneAndUpdate(
      { _id },
      {
        password: passwordHash,
        active: 0,
        updatedAt: Date.now()
      },
      { new: true }
    )
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        if (!result) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: MESSAGES.SYSTEM.ERROR || 'Lỗi hệ thống khi reset mật khẩu',
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
      message: {
        head: 'Thông báo',
        body: 'Reset mật khẩu thành công',
      },
    });

    // Ghi log hệ thống
    SystemLogModel.create(
      {
        user: _.get(req, 'user.id', ''),
        action: 'reset_password',
        description: 'Reset mật khẩu về mặc định',
        data: { userId: _id },
        updatedData: { userId: _id, resetAt: Date.now() },
      },
      () => {}
    );
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