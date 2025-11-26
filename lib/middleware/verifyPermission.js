const _ = require('lodash');
const redisConnections = require('../connections/redis');
const CONSTANTS = require('../const');
const MESSAGES = require('../message');
const async = require('async');
const config = require('config');

module.exports = (allowPermission) => {
  return (req, res, next) => {
    let permissionsCheck = [];
    let permissions = _.get(req, 'user.permissions', []);
    if (_.get(req, 'user.role') === 'admin') {
      return next();
    }
    if (!permissions.length) {
      return res.json({
        code: CONSTANTS.CODE.ROLE_BLOCK,
        message: MESSAGES.USER.ROLE_BLOCK,
      });
    }
    permissions.map((permission) => {
      permissionsCheck.push(permission.code);
    });

    if (!permissionsCheck.includes(allowPermission)) {
      return res.json({
        code: CONSTANTS.CODE.ROLE_BLOCK,
        message: MESSAGES.USER.ROLE_BLOCK,
      });
    }
    next();
  };
};
