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
  const { username, name, code, phones, email, gender, avatar, dob, address, role, permissions, region, workingRegions } = req.body || '';
  const password = config.passwordDefault;
  let passwordHash;

  let newUser;
  let rankImage;

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

  const checkAndEncryptPassword = (next) => {
    bcrypt.hash(password, 10, function (err, hash) {
      if (err) {
        return next(err);
      }
      passwordHash = hash;
      next();
    });
  };

  const createUser = (next) => {
    User.create(
      {
        username,
        name,
        code,
        email,
        phones,
        gender,
        dob,
        address,
        avatar: req.body.avatar || avatar,
        password: passwordHash,
        role,
        permissions,
        region: region || '',
        workingRegions: workingRegions || [],
      },
      (err, result) => {
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
      }
    );
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: newUser._id,
      message: MESSAGES.USER.CREATE_SUCCESS,
    });

    // Trigger statistics update khi tạo user mới
    SystemLogModel.create(
      {
        user: _.get(req, 'user.id', ''),
        action: 'create_user',
        description: 'Tạo người dùng mới',
        data: req.body,
        updatedData: newUser,
      },
      () => {}
    );
  };

  async.waterfall([checkParams, checkUserExists, checkAndEncryptPassword, createUser, writeLog], (err, data) => {
    if (_.isError(err)) {
      logger.logError([err], req.originalUrl, req.body);
      MailUtil.sendMail(`${req.originalUrl} - ${err} - ${JSON.stringify(req.body)}`);
    }
    logger.logInfo('Create user request', err, data);
    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
