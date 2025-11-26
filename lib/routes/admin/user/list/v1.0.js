const _ = require('lodash');
const async = require('async');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');

const escapeStringRegexp = require('escape-string-regexp');

module.exports = (req, res) => {
  const limit = Math.max(1, Math.min(100, _.get(req, 'body.limit', 10))); // Giới hạn từ 1 đến 100
  const page = Math.max(0, _.get(req, 'body.page', 0));
  const sort = _.get(req, 'body.sort', '-createdAt'); // Mặc định sắp xếp theo thời gian tạo mới nhất
  const textSearch = _.get(req, 'body.textSearch', '');
  const status = _.get(req, 'body.status', null);
  const active = _.get(req, 'body.active', null);
  let obj = {};
  let count = 0;
  const checkParams = (next) => {
    // Filter by status
    if (status !== null && status !== undefined && status !== '') {
      obj.status = parseInt(status);
    }

    // Filter by active status
    if (active !== null && active !== undefined && active !== '') {
      obj.active = parseInt(active);
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
          phone: {
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
    User.find(obj, '-password -passwordLevel2', options)
      .populate('permissions', 'name code')
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }
        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          data: results,
          count,
          total: count * limit,
          page,
          limit
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
