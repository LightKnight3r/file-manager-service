const _ = require('lodash');
const async = require('async');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const UserModel = require('../../../models/user');

module.exports = (req, res) => {
  const userId = _.get(req, 'user.id');
  const { name, email, phone, region, workingRegions } = req.body;

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      });
    }
    next();
  };

  const updateUser = (next) => {
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (region) updateData.region = region;
    if (workingRegions && Array.isArray(workingRegions)) updateData.workingRegions = workingRegions;

    if (Object.keys(updateData).length === 0) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.USER.NOT_CHANGE
      });
    }

    updateData.updatedAt = Date.now();

    UserModel.findOneAndUpdate(
      { _id: userId, status: 1 },
      { $set: updateData },
      { new: true }
    )
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
        message: MESSAGES.USER.UPDATE_SUCCESS,
        data: user
      });
    });
  };

  async.waterfall([checkParams, updateUser], (err, data) => {
    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
