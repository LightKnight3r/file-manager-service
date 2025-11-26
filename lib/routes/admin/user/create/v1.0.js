const _ = require('lodash');
const async = require('async');
const ms = require('ms');
const { v4: uuidv4 } = require('uuid');
const config = require('config');
const util = require('util');
const rp = require('request-promise');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const bcrypt = require('bcryptjs');
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const tool = require('../../../../utils/tool');
const MailUtil = require('../../../../utils/mail');
const validator = require('validator');

module.exports = (req, res) => {
  const { username, name, phone, email, avatar, permissions } = req.body || '';
  const password = config.passwordDefault;
  const passwordLevel2 = config.passwordLevel2Default || password;
  let passwordHash;
  let passwordLevel2Hash;

  let newUser;

  const checkParams = (next) => {
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

  const checkAndEncryptPassword = (next) => {
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

  const createUser = (next) => {
    const userData = {
      username: username.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: passwordHash,
      passwordLevel2: passwordLevel2Hash,
      permissions: permissions || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Thêm các trường tùy chọn nếu có
    if (phone && phone.trim()) {
      userData.phone = phone.trim();
    }
    if (avatar) {
      userData.avatar = avatar;
    }

    User.create(userData, (err, result) => {
      if (err) {
        return next(err);
      }
      if (!result) {
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR,
        });
      }
      newUser = result;
      next();
    });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: {
        _id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        avatar: newUser.avatar,
        status: newUser.status,
        active: newUser.active,
        createdAt: newUser.createdAt
      },
      message: MESSAGES.USER.CREATE_SUCCESS || {
        head: 'Thông báo',
        body: 'Tạo người dùng thành công'
      },
    });
  };

  async.waterfall([checkParams, checkUserExists, checkAndEncryptPassword, createUser, writeLog], (err, data) => {
    if (_.isError(err)) {
      console.error('Create user error:', err);
    }
    
    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR || {
        head: 'Thông báo',
        body: 'Lỗi hệ thống'
      },
    });

    res.json(data || err);
  });
};
