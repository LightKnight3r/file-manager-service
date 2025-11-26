const _ = require('lodash');
const async = require('async');
const Permission = require('../../../../models/permission');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const escapeStringRegexp = require('escape-string-regexp');

module.exports = (req, res) => {
  const textSearch = _.get(req, 'body.textSearch', '');
  const sort = _.get(req, 'body.sort', 1);

  let query = {};
  let groupedPermissions = {};

  const buildQuery = (next) => {
    // Text search nếu có
    if (textSearch && textSearch.trim()) {
      const $regex = escapeStringRegexp(textSearch.trim());
      query['$or'] = [
        {
          group: {
            $regex,
            $options: 'i',
          },
        },
      ];
    }

    next();
  };

  const getAllPermissions = (next) => {
    const sortOrder = sort == 1 ? 'group' : '-group';

    Permission.find(query)
      .sort(sortOrder)
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }

        // Nhóm permissions theo group
        groupedPermissions = _.groupBy(results, 'group');

        // Sắp xếp các permissions trong từng group theo name
        Object.keys(groupedPermissions).forEach((groupKey) => {
          groupedPermissions[groupKey] = _.sortBy(groupedPermissions[groupKey], 'name');
        });

        // Chuyển đổi object thành array để dễ sử dụng trong frontend
        const groupedArray = Object.keys(groupedPermissions)
          .sort() // Sắp xếp tên group theo alphabet
          .map((groupKey) => ({
            group: groupKey,
            permissions: groupedPermissions[groupKey],
          }));

        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          data: groupedArray,
          totalGroups: groupedArray.length,
        });
      });
  };

  async.waterfall([buildQuery, getAllPermissions], (err, data) => {
    if (_.isError(err)) {
      console.error('List permissions by group error:', err);
      data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      };
    }

    res.json(data || err);
  });
};
