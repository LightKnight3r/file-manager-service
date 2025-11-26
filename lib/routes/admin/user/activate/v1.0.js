const _ = require('lodash')
const async = require('async')
const User = require('../../../../models/user')
const CONSTANTS = require('../../../../const')
const MESSAGES = require('../../../../message')

module.exports = (req, res) => {

  const {id} = req.body || ''
  let updatedData = {};

  const checkParams = (next) => {
    if(!id) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'ID người dùng không được để trống'
        }
      })
    }
    next(null);
  }

  const checkUserExists = (next) => {
    User
      .findById(id)
      .lean()
      .exec((err, result) => {
        if(err) {
          return next(err)
        }
        if(!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Người dùng không tồn tại'
            }
          })
        }
        if(_.get(result, 'status') === 1) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Tài khoản đã được kích hoạt'
            }
          })
        }
        next()
      })
  }

  const activateUser = (next) => {
    User
      .findOneAndUpdate({
        _id: id,
        status: 0
      },
      {
        status: 1,
        updatedAt: Date.now()
      },
      {new: true}
      )
      .select('-password -passwordLevel2')
      .lean()
      .exec((err, result) => {
        if(err) {
          return next(err);
        }
        if(!result) {
          return next({
            code: CONSTANTS.CODE.WRONG_PARAMS,
            message: {
              head: 'Thông báo',
              body: 'Không thể kích hoạt tài khoản'
            }
          });
        }
        updatedData = result;
        next(null);
      })
  }

  const writeLog = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: {
        _id: updatedData._id,
        username: updatedData.username,
        name: updatedData.name,
        status: updatedData.status,
        updatedAt: updatedData.updatedAt
      },
      message: {
        head: 'Thông báo',
        body: 'Kích hoạt tài khoản thành công',
      },
    });
  };

  async.waterfall([
    checkParams,
    checkUserExists,
    activateUser,
    writeLog
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Activate user error:', err);
    }
    
    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR || {
        head: 'Thông báo',
        body: 'Lỗi hệ thống'
      }
    });

    res.json(data || err);
  })
}
