const _ = require('lodash');
const redisConnections = require('../connections/redis');
const CONSTANTS = require('../const');
const MESSAGES = require('../message');

module.exports = (permission) => {
  return (req, res, next) => {
    const userPermissions = _.get(req, 'user.permissions', []);

    // Nếu không có permission hoặc user là admin thì cho phép
    if (!permission || _.get(req, 'user.role') === 'admin') {
      return next();
    }

    // Kiểm tra permission - có thể là string hoặc array
    let hasPermission = false;
    if (Array.isArray(permission)) {
      // Nếu permission là array, chỉ cần user có ít nhất 1 permission trong array
      hasPermission = permission.some((perm) => userPermissions.includes(perm));
    } else {
      // Nếu permission là string
      hasPermission = userPermissions.includes(permission);
    }

    if (hasPermission) {
      return next();
    }

    res.json({
      code: CONSTANTS.CODE.WRONG_PARAMS,
      message: MESSAGES.USER.ROLE_BLOCK,
    });
  };
};
