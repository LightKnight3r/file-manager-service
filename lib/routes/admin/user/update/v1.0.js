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
  let { username, name, code, phones, email, gender, avatar, dob, address, role, permissions, region, workingRegions } = req.body || '';
  const _id = req.body._id || '';
  let permissionInGroup = [];
  const userId = _.get(req, 'user.id', '');
  let objUpdate = {};
  let updatedData = {};
  let rankImage;
  const checkParams = (next) => {
    if (!_id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
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
    if (!code || (code && !code.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mã người dùng không được để trống',
        },
      });
    }
    if (!role || (role && !['admin', 'user'].includes(role))) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Vai trò không hợp lệ',
        },
      });
    }
    next(null);
  };

  const checkUserExists = (next) => {
    User.find({
      _id: {
        $ne: _id,
      },
      $or: [
        {
          username,
        },
        {
          email,
        },
        {
          phones: {
            $in: phones,
          },
        },
      ],
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
              body: 'Email cán bộ đã tồn tại',
            };
          } else if (existingUser.phones.some((phone) => phones.includes(phone))) {
            errorMessage = {
              head: 'Thông báo',
              body: 'Số điện thoại cán bộ đã tồn tại',
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
      username,
      name,
      code,
      dob,
      gender,
      address,
      email,
      phones,
      avatar: req.body.avatar || avatar,
      role,
      permissions,
      region: region || '',
      workingRegions: workingRegions || [],
      updatedAt: Date.now(),
    };
    User.findOneAndUpdate(
      {
        _id,
      },
      objUpdate,
      { new: true }
    )
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        updatedData = result;
        next();
      });
  };

  const updateRedisUserData = (next) => {
    const userId = _id;

    // Cập nhật thông tin user trong Redis nếu user đang đăng nhập
    redisConnection('master')
      .getConnection()
      .get(`user:${userId}`, (err, token) => {
        if (err) {
          console.error('Redis get error:', err);
          return next(); // Tiếp tục dù có lỗi Redis
        }

        if (token) {
          // User đang đăng nhập, cập nhật thông tin trong Redis
          const objSign = {
            id: userId,
            permissions: updatedData.permissions || [],
            role: updatedData.role,
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
      message: MESSAGES.USER.UPDATE_SUCCESS,
    });

    SystemLogModel.create(
      {
        user: _.get(req, 'user.id', ''),
        action: 'update_user',
        description: 'Cập nhật người dùng',
        data: objUpdate,
        updatedData,
      },
      () => {}
    );
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
