const _ = require('lodash');
const async = require('async');
const ms = require('ms');
const config = require('config');
const util = require('util');
const rp = require('request-promise');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const tool = require('../../../../utils/tool');
const MailUtil = require('../../../../utils/mail');
const validator = require('validator');
const redisConnection = require('../../../../connections/redis');
const SystemLogModel = require('../../../../models/systemLog');

module.exports = (req, res) => {
  let { username, name, phone, email, avatar, permissions } = req.body || '';
  const _id = req.body._id || '';
  const userId = _.get(req, 'user.id', '');
  let objUpdate = {};
  let updatedData = {};
  const checkParams = (next) => {
    if (!_id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'ID người dùng không được để trống',
        },
      });
    }
    if (!username || (username && !username.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Bạn chưa nhập tên đăng nhập',
        },
      });
    }
    if (!email || (email && !email.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Bạn chưa nhập email',
        },
      });
    }
    if (!validator.isEmail(email)) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Email không hợp lệ',
        },
      });
    }
    if (!name || (name && !name.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Bạn chưa nhập tên',
        },
      });
    }
    next(null);
  };

  const checkUserExists = (next) => {
    const queryConditions = [
      { username },
      { email }
    ];
    
    // Thêm điều kiện phone nếu có
    if (phone && phone.trim()) {
      queryConditions.push({ phone });
    }

    User.find({
      _id: {
        $ne: _id,
      },
      $or: queryConditions,
      status: 1,
    })
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }
        if (results.length) {
          // Kiểm tra cụ thể trường nào bị trùng để trả về message phù hợp
          const existingUser = results[0];
          let errorMessage = MESSAGES.USER.EXISTS;

          if (existingUser.username === username) {
            errorMessage = {
              head: 'Thông báo',
              body: 'Tên đăng nhập đã tồn tại',
            };
          } else if (existingUser.email === email) {
            errorMessage = {
              head: 'Thông báo',
              body: 'Email đã tồn tại',
            };
          } else if (existingUser.phone === phone) {
            errorMessage = {
              head: 'Thông báo',
              body: 'Số điện thoại đã tồn tại',
            };
          }

          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: errorMessage,
          });
        }
        next();
      });
  };

  const updateUser = (next) => {
    objUpdate = {
      username: username.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      permissions: permissions || [],
      updatedAt: Date.now(),
    };

    // Thêm các trường tùy chọn nếu có
    if (phone && phone.trim()) {
      objUpdate.phone = phone.trim();
    }
    if (avatar) {
      objUpdate.avatar = avatar;
    }

    User.findOneAndUpdate(
      {
        _id,
        status: 1
      },
      objUpdate,
      { new: true }
    )
      .select('-password -passwordLevel2')
      .populate('permissions', 'name code')
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
        updatedData = result;
        next();
      });
  };

  const updateRedisUserData = (next) => {
    // Cập nhật thông tin user trong Redis nếu user đang đăng nhập
    redisConnection('master')
      .getConnection()
      .get(`user:${_id}`, (err, token) => {
        if (err) {
          console.error('Redis get error:', err);
          return next(); // Tiếp tục dù có lỗi Redis
        }

        if (token) {
          // User đang đăng nhập, cập nhật thông tin trong Redis
          const objSign = {
            id: _id,
            permissions: updatedData.permissions || [],
            username: updatedData.username,
            name: updatedData.name,
            email: updatedData.email,
            phone: updatedData.phone,
            avatar: updatedData.avatar,
            status: updatedData.status,
            active: updatedData.active
          };

          redisConnection('master')
            .getConnection()
            .set(`user:${token}`, JSON.stringify(objSign), (err, result) => {
              if (err) {
                console.error('Redis set error:', err);
              }
              next(); // Tiếp tục dù có lỗi Redis
            });
        } else {
          next(); // User không đăng nhập, bỏ qua bước này
        }
      });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: updatedData,
      message: MESSAGES.USER.UPDATE_SUCCESS || {
        head: 'Thông báo',
        body: 'Cập nhật người dùng thành công'
      },
    });
  };

  async.waterfall([checkParams, checkUserExists, updateUser, updateRedisUserData, writeLog], (err, data) => {
    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
