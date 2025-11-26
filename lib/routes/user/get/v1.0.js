const _ = require('lodash');
const async = require('async');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const SystemLog = require('../../../models/systemLog');

module.exports = (req, res) => {
  const userId = req.user.id || '';
  const appName = _.get(req, 'body.appName', '');
  const platform = _.get(req, 'body.platform', 'web');
  let userInf;
  console.log(req.user.id);
  console.log(req.body);

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS,
      });
    }
    next();
  };

  const getUser = (next) => {
    User.findById(userId)
      // .populate('permissions', 'code active status -_id')
      // .populate({
      //   path: 'units',
      //   select: 'name parentPath icon',
      //   populate: {
      //     path: 'parentPath',
      //     select: 'name',
      //   },
      // })
      // .populate('positions', 'name unit role')
      // .populate({
      //   path: 'areas',
      //   select: 'name level parent parentPath',
      //   populate: {
      //     path: 'parent',
      //     select: 'name',
      //   },
      // })
      .select('-password')
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        if (!result) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: MESSAGES.SYSTEM.ERROR,
          });
        }
        userInf = result;
        next();
      });
  };

  const trackUserAccess = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: userInf,
    });

    SystemLog.create(
      {
        user: userId,
        action: 'user_app_access',
        description: `User accessed app: ${appName}`,
        data: {
          platform: platform,
          appName: appName,
          userAgent: req.headers['user-agent'] || '',
          ip: req.headers.ip || req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
          device: req.headers.device ? JSON.parse(req.headers.device) : {},
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to log user access:', err);
        }
      }
    );
  };

  async.waterfall([checkParams, getUser, trackUserAccess], (err, data) => {
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
