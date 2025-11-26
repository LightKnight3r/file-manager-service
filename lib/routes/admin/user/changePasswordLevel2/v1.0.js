const _ = require('lodash');
const async = require('async');
const bcrypt = require('bcryptjs');
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');

module.exports = (req, res) => {
  const { _id, oldPasswordLevel2, newPasswordLevel2 } = req.body || '';
  let passwordLevel2Hash;
  let updatedUser;

  const checkParams = (next) => {
    if (!_id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'ID người dùng không được để trống'
        }
      });
    }
    if (!oldPasswordLevel2) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mật khẩu cấp 2 cũ không được để trống'
        }
      });
    }
    if (!newPasswordLevel2) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mật khẩu cấp 2 mới không được để trống'
        }
      });
    }
    if (newPasswordLevel2.length < 6) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mật khẩu cấp 2 phải có ít nhất 6 ký tự'
        }
      });
    }
    next(null);
  };

  const checkUserAndPassword = (next) => {
    User.findOne({
      _id,
      status: 1
    })
      .lean()
      .exec((err, user) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa'
            }
          });
        }

        // Kiểm tra mật khẩu cấp 2 cũ
        bcrypt.compare(oldPasswordLevel2, user.passwordLevel2, (err, isMatch) => {
          if (err) {
            return next(err);
          }
          if (!isMatch) {
            return next({
              code: CONSTANTS.CODE.WRONG_PARAMS,
              message: {
                head: 'Thông báo',
                body: 'Mật khẩu cấp 2 cũ không đúng'
              }
            });
          }
          next();
        });
      });
  };

  const encryptNewPassword = (next) => {
    bcrypt.hash(newPasswordLevel2, 10, function (err, hash) {
      if (err) {
        return next(err);
      }
      passwordLevel2Hash = hash;
      next();
    });
  };

  const updatePassword = (next) => {
    User.findOneAndUpdate(
      { 
        _id,
        status: 1 
      },
      {
        passwordLevel2: passwordLevel2Hash,
        activeLevel2: 1,
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
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: {
              head: 'Thông báo',
              body: 'Lỗi hệ thống khi cập nhật mật khẩu'
            }
          });
        }
        updatedUser = result;
        next();
      });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: {
        _id: updatedUser._id,
        username: updatedUser.username,
        name: updatedUser.name,
        activeLevel2: updatedUser.activeLevel2,
        lastTimeChangePassLevel2: updatedUser.lastTimeChangePassLevel2
      },
      message: {
        head: 'Thông báo',
        body: 'Đổi mật khẩu cấp 2 thành công'
      }
    });
  };

  async.waterfall([
    checkParams,
    checkUserAndPassword,
    encryptNewPassword,
    updatePassword,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Change password level 2 error:', err);
    }

    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR || {
        head: 'Thông báo',
        body: 'Lỗi hệ thống'
      }
    });

    res.json(data || err);
  });
};
