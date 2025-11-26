const _ = require('lodash');
const async = require('async');
const Permission = require('../../../../models/permission');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const SystemLogModel = require('../../../../models/systemLog');
const { formatGroupName } = require('../../../../utils/permissionUtils');

module.exports = (req, res) => {
  const { _id, name, code, description, group } = req.body || '';
  let updatedPermission;

  const checkParams = (next) => {
    if (!_id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'ID quyền không được để trống'
        }
      });
    }

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

    // Validate code format
    const codeRegex = /^[a-z0-9_]+$/;
    if (!codeRegex.test(code.trim())) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Mã quyền chỉ được chứa chữ thường, số và dấu gạch dưới'
        }
      });
    }

    next(null);
  };

  const checkPermissionExists = (next) => {
    // Kiểm tra quyền tồn tại
    Permission.findById(_id)
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }

        if (!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Quyền không tồn tại'
            }
          });
        }

        next();
      });
  };

  const checkDuplicatePermission = (next) => {
    // Kiểm tra trùng lặp với các quyền khác (loại trừ chính nó)
    Permission.findOne({
      _id: { $ne: _id },
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

  const updatePermission = (next) => {
    // Format group name trước khi cập nhật
    const formattedGroup = formatGroupName(group || 'default');

    const updateData = {
      name: name.trim(),
      code: code.trim(),
      description: description ? description.trim() : '',
      group: formattedGroup,
      updatedAt: Date.now()
    };

    Permission.findByIdAndUpdate(_id, updateData, { new: true })
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }

        if (!result) {
          return next({
            code: CONSTANTS.CODE.SYSTEM_ERROR,
            message: MESSAGES.SYSTEM.ERROR
          });
        }

        updatedPermission = result;
        next();
      });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: updatedPermission,
      message: {
        head: 'Thông báo',
        body: 'Cập nhật quyền thành công'
      }
    });

    // Ghi log hệ thống
    SystemLogModel.create({
      user: _.get(req, 'user.id', ''),
      action: 'update_permission',
      description: 'Cập nhật quyền',
      data: req.body,
      updatedData: updatedPermission
    }, () => {});
  };

  async.waterfall([
    checkParams,
    checkPermissionExists,
    checkDuplicatePermission,
    updatePermission,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Update permission error:', err);
    }

    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR
    });

    res.json(data || err);
  });
};