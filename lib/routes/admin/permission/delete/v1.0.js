const _ = require('lodash');
const async = require('async');
const Permission = require('../../../../models/permission');
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');
const SystemLogModel = require('../../../../models/systemLog');

module.exports = (req, res) => {
  const { _id } = req.body || '';
  let deletedPermission;

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

    next(null);
  };

  const checkPermissionExists = (next) => {
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

        deletedPermission = result;
        next();
      });
  };

  const checkPermissionInUse = (next) => {
    // Kiểm tra xem quyền có đang được sử dụng bởi user nào không
    User.findOne({
      permissions: { $in: [deletedPermission.code] }
    })
    .lean()
    .exec((err, result) => {
      if (err) {
        return next(err);
      }

      if (result) {
        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: {
            head: 'Thông báo',
            body: 'Không thể xóa quyền này vì đang được sử dụng bởi một số người dùng'
          }
        });
      }

      next();
    });
  };

  const deletePermission = (next) => {
    Permission.findByIdAndDelete(_id)
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

        next();
      });
  };

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      message: {
        head: 'Thông báo',
        body: 'Xóa quyền thành công'
      }
    });

    // Ghi log hệ thống
    SystemLogModel.create({
      user: _.get(req, 'user.id', ''),
      action: 'delete_permission',
      description: 'Xóa quyền',
      data: req.body,
      updatedData: deletedPermission
    }, () => {});
  };

  async.waterfall([
    checkParams,
    checkPermissionExists,
    checkPermissionInUse,
    deletePermission,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Delete permission error:', err);
    }

    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR
    });

    res.json(data || err);
  });
};