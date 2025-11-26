const _ = require('lodash');
const async = require('async');
const Permission = require('../../../../models/permission');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const escapeStringRegexp = require('escape-string-regexp');

module.exports = (req, res) => {
  const limit = _.get(req, 'body.limit', 10);
  const page = _.get(req, 'body.page', 0);
  const sort = _.get(req, 'body.sort', 1);
  const textSearch = _.get(req, 'body.textSearch', '');
  const group = _.get(req, 'body.group', '');

  let query = {};
  let count = 0;

  const buildQuery = (next) => {
    // Filter by group
    if (group && group.trim()) {
      query.group = group.trim();
    }

    // Text search
    if (textSearch && textSearch.trim()) {
      const $regex = escapeStringRegexp(textSearch.trim());
      query['$or'] = [
        {
          name: {
            $regex,
            $options: 'i'
          }
        },
        {
          code: {
            $regex,
            $options: 'i'
          }
        },
        {
          description: {
            $regex,
            $options: 'i'
          }
        }
      ];
    }

    next();
  };

  const countPermissions = (next) => {
    Permission.countDocuments(query)
      .exec((err, total) => {
        if (err) {
          return next(err);
        }
        count = Math.ceil(total / limit);
        next();
      });
  };

  const listPermissions = (next) => {
    const skip = page * limit;
    const sortOrder = sort == 1 ? 'createdAt' : '-createdAt';

    Permission.find(query)
      .limit(limit)
      .skip(skip)
      .sort(sortOrder)
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }

        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          data: results,
          count,
          total: count * limit
        });
      });
  };

  async.waterfall([
    buildQuery,
    countPermissions,
    listPermissions
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('List permissions error:', err);
      data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR
      };
    }

    res.json(data || err);
  });
};