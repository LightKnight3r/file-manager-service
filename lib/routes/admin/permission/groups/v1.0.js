const _ = require('lodash');
const Permission = require('../../../../models/permission');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');

module.exports = (req, res) => {
  // Lấy danh sách tất cả các groups có sẵn trong database
  Permission.distinct('group').exec((err, groups) => {
    if (err) {
      console.error('Get permission groups error:', err);
      return res.json({
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });
    }

    res.json({
      code: CONSTANTS.CODE.SUCCESS,
      data: groups,
    });
  });
};
