const _ = require('lodash');
const async = require('async');
const Permission = require('../../../../models/permission');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const SystemLogModel = require('../../../../models/systemLog');
const { formatGroupName } = require('../../../../utils/permissionUtils');

module.exports = (req, res) => {
  const { name, code, description, group } = req.body || '';
  let newPermission;

  const checkParams = (next) => {
    if (!name || !name.trim()) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Tên quyền không được để trống'
        }
      });
    }

    if (!code || !code.trim()) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mã quyền không được để trống'
        }
      });
    }

    // Validate code format (chỉ cho phép chữ thường, số, gạch ngang và gạch dưới)
    const codeRegex = /^[a-z0-9_-]+$/;
    if (!codeRegex.test(code.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mã quyền chỉ được chứa chữ thường, số, gạch ngang và gạch dưới'
        }
      });
    }

    next(null);
  };

  const checkPermissionExists = (next) => {
    Permission.findOne({
      $or: [
        { code: code.trim() },
        { name: name.trim() }
      ]
    })
    .lean()
    .exec((err, result) => {
      if (err) {
        return next(err);
      }

      if (result) {
        const errorMessage = result.code === code.trim()
          ? 'Mã quyền đã tồn tại'
          : 'Tên quyền đã tồn tại';

        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: {
            head: 'Thông báo',
            body: errorMessage
          }
        });
      }

      next();
    });
  };

  const createPermission = (next) => {
    // Format group name trước khi tạo
    const formattedGroup = formatGroupName(group || 'default');

    Permission.create({
      name: name.trim(),
      code: code.trim(),
      description: description ? description.trim() : '',
      group: formattedGroup
    }, (err, result) => {
      if (err) {
        return next(err);
      }

      if (!result) {
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }

      newPermission = result;
      next();
    });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: newPermission,
      message: {
        head: 'Thông báo',
        body: 'Tạo quyền thành công'
      }
    });

    // Ghi log hệ thống
    SystemLogModel.create({
      user: _.get(req, 'user.id', ''),
      action: 'create_permission',
      description: 'Tạo quyền mới',
      data: req.body,
      updatedData: newPermission
    }, () => {});
  };

  async.waterfall([
    checkParams,
    checkPermissionExists,
    createPermission,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Create permission error:', err);
    }

    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR
    });

    res.json(data || err);
  });
};