const _ = require('lodash');
const async = require('async');
const ms = require('ms');
const config = require('config');
const util = require('util');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const bcrypt = require('bcryptjs');

const UserModel = require('../../../models/user');
const redisConnection = require('../../../connections/redis');
const jwt = require('jsonwebtoken');
// const NotifyManager = require('../../../job/notifyManager');
const SystemLog = require('../../../models/systemLog');

module.exports = (req, res) => {
  let username = req.body.username || '';
  const password = req.body.password || '';
  let userInf;
  let token;
  let appName = '';
  if (req.body.appName) {
    appName = req.body.appName;
  }
  if (req.query.appName) {
    appName = req.query.appName;
  }

  let stringToken = 'user';
  if (appName && appName !== 'cms') {
    stringToken = appName;
  }

  const checkParams = (next) => {
    username = username.trim();
    if (!username) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Bạn chưa nhập tên đăng nhập',
        },
      });
    }
    if (!password) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Bạn chưa nhập mật khẩu',
        },
      });
    }
    next();
  };

  const findUser = (next) => {
    UserModel.find({
      $or: [{ username: username }, { email: username }],
    })
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }
        if (!results.length) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: {
              head: 'Thông báo',
              body: 'Tên đăng nhập chưa chính xác',
            },
          });
        }
        if (results.length > 1) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: MESSAGES.SYSTEM.ERROR,
          });
        }
        userInf = results[0];
        if (userInf.status == 0) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: MESSAGES.USER.INACTIVE,
          });
        }
        next();
      });
  };

  const checkPassword = (next) => {
    if (!userInf.password) {
      return next({
        code: CONSTANTS.CODE.FAIL,
        message: {
          head: 'Thông báo',
          body: 'Bạn chưa có mật khẩu, vui lòng liên hệ admin để được cấp mật khẩu.',
        },
      });
    }
    bcrypt.compare(password, userInf.password, function (err, res) {
      if (err) {
        return next(err);
      }

      if (!res) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: {
            head: 'Thông báo',
            body: 'Mật khẩu không chính xác, vui lòng thử lại. Xin cảm ơn.',
          },
        });
      }
      next();
    });
  };

  const deleteOldToken = (next) => {
    const userId = userInf._id.toHexString();
    redisConnection('master')
      .getConnection()
      .get(`${stringToken}:${userId}`, (err, token) => {
        if (err) {
          return next(err);
        }

        if (token) {
          redisConnection('master')
            .getConnection()
            .del(`${stringToken}:${token}`, (err, result) => {
              if (err) {
                return next(err);
              }
              next();
            });
        } else {
          next();
        }
      });
  };

  const createNewToken = (next) => {
    const token = jwt.sign({ username, password, id: userInf._id }, config.secretKey);

    const userId = userInf._id.toHexString();
    const permissions = userInf.permissions;
    const objSign = {
      id: userId,
      permissions,
      role: userInf.role,
      region: userInf.region || '',
      workingRegions: userInf.workingRegions || [],
    };

    redisConnection('master')
      .getConnection()
      .multi()
      .set(`${stringToken}:${userId}`, token)
      .set(`${stringToken}:${token}`, JSON.stringify(objSign))
      .exec((err, result) => {
        if (err) {
          return next(err);
        }

        const data = _.merge({}, userInf, { token });
        _.unset(data, 'password');
        let deviceName = '';
        let device = {};
        if (req.headers.device) {
          device = JSON.parse(req.headers.device);
          deviceName = `${_.get(device, 'device.brand', '')} ${_.get(device, 'os.name', '')} - ${_.get(device, 'os.version', '')}:${_.get(device, 'client.name', '')} - ${_.get(device, 'client.version', '')}`;
          if (req.headers.ip) {
            device.ip = req.headers.ip;
          }
        }
        // if (deviceName) {
        //   NotifyManager.handleNotify(userId, {
        //     title: 'Thông báo',
        //     message: `Tài khoản của bạn vừa đăng nhập trên thiết bị: ${deviceName}`,
        //     data: {
        //       link: '',
        //     },
        //     eventName: 'noti_update',
        //   });
        // }
        device.appName = appName;
        SystemLog.create(
          {
            user: userInf._id,
            action: 'log_in',
            description: 'Đăng nhập',
            data: device,
          },
          () => {}
        );
        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          data,
        });
      });
  };
  async.waterfall([checkParams, findUser, checkPassword, deleteOldToken, createNewToken], (err, data) => {
    if (_.isError(err)) {
      logger.logError([err], req.originalUrl, req.body);
      MailUtil.sendMail(`${req.originalUrl} - ${err} - ${JSON.stringify(req.body)}`);
    }
    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
