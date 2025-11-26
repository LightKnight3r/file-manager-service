const _ = require('lodash');
const async = require('async');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const UserModel = require('../../../models/user');

module.exports = (req, res) => {
  const userId = _.get(req, 'user.id');

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      });
    }
    next();
  };

  const getUserProfile = (next) => {
    UserModel.findOne({
      _id: userId,
      status: 1
    })
    .select('-password')
    .lean()
    .exec((err, user) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: MESSAGES.USER.NOT_EXISTS
        });
      }

      next(null, {
        code: CONSTANTS.CODE.SUCCESS,
        data: user
      });
    });
  };

  async.waterfall([checkParams, getUserProfile], (err, data) => {
    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
