const _ = require('lodash');
const Permission = require('../../../../models/permission');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');

module.exports = (req, res) => {
  const { _id } = req.body || '';

  if (!_id) {
    return res.json({
      code: CONSTANTS.CODE.WRONG_PARAMS,
      message: {
        head: 'Thông báo',
        body: 'ID quyền không được để trống'
      }
    });
  }

  Permission.findById(_id)
    .lean()
    .exec((err, result) => {
      if (err) {
        console.error('Get permission error:', err);
        return res.json({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }

      if (!result) {
        return res.json({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: {
            head: 'Thông báo',
            body: 'Quyền không tồn tại'
          }
        });
      }

      res.json({
        code: CONSTANTS.CODE.SUCCESS,
        data: result
      });
    });
};