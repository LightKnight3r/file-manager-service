const _ = require('lodash');
const async = require('async');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');

const escapeStringRegexp = require('escape-string-regexp');

module.exports = (req, res) => {
  const limit = _.get(req, 'body.limit', 10);
  const page = _.get(req, 'body.page', 0);
  const sort = _.get(req, 'body.sort', 'createdAt');
  const textSearch = _.get(req, 'body.textSearch', '');
  const status = _.get(req, 'body.status', null);
  const role = _.get(req, 'body.role', '');
  const gender = _.get(req, 'body.gender', '');
  let obj = {};
  let count = 0;
  const checkParams = (next) => {
    // Filter by status
    if (status !== null && status !== undefined && status !== '') {
      obj.status = status;
    }

    // Filter by role
    if (role && role.trim()) {
      obj.role = role.trim();
    }

    // Filter by gender
    if (gender && gender.trim()) {
      obj.gender = gender.trim();
    }

    // Text search
    if (textSearch && textSearch.trim()) {
      const $regex = escapeStringRegexp(textSearch.trim());
      obj['$or'] = [
        {
          name: {
            $regex,
            $options: 'i',
          },
        },
        {
          phones: {
            $regex,
            $options: 'i',
          },
        },
        {
          code: {
            $regex,
            $options: 'i',
          },
        },
        {
          email: {
            $regex,
            $options: 'i',
          },
        },
        {
          username: {
            $regex,
            $options: 'i',
          },
        },
      ];
    }
    next();
  };

  const countUser = (next) => {
    User.countDocuments(obj)
      .lean()
      .exec((err, total) => {
        count = Math.ceil(total / limit);
        next();
      });
  };

  const listUser = (next) => {
    const skip = page * limit;
    const options = {
      limit,
      skip,
      sort,
    };
    User.find(obj, '-password', options)
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }
        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          data: results,
          count,
        });
      });
  };

  async.waterfall([checkParams, countUser, listUser], (err, data) => {
    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
