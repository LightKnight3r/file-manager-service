const _ = require('lodash');
const async = require('async');
const User = require('../../../../models/user');
const CONSTANTS = require('../../../../const');
const MESSAGES = require('../../../../message');

module.exports = (req, res) => {
  let stats = {};

  const getUserStats = (next) => {
    async.parallel({
      // Tổng số user
      totalUsers: (callback) => {
        User.countDocuments({})
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User đang hoạt động
      activeUsers: (callback) => {
        User.countDocuments({ status: 1 })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User bị vô hiệu hóa
      inactiveUsers: (callback) => {
        User.countDocuments({ status: 0 })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User chưa đổi mật khẩu
      usersNotChangedPassword: (callback) => {
        User.countDocuments({ 
          status: 1,
          active: 0 
        })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User chưa đổi mật khẩu cấp 2
      usersNotChangedPasswordLevel2: (callback) => {
        User.countDocuments({ 
          status: 1,
          activeLevel2: 0 
        })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User có số lần nhập sai mật khẩu cấp 2 > 0
      usersWithWrongPasswordLevel2: (callback) => {
        User.countDocuments({ 
          status: 1,
          countWrongPassLevel2: { $gt: 0 } 
        })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User được tạo trong 30 ngày qua
      recentUsers: (callback) => {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        User.countDocuments({ 
          createdAt: { $gte: thirtyDaysAgo }
        })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      },
      
      // User được tạo hôm nay
      todayUsers: (callback) => {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
        
        User.countDocuments({ 
          createdAt: { 
            $gte: startOfDay,
            $lte: endOfDay 
          }
        })
          .exec((err, count) => {
            callback(err, count || 0);
          });
      }
      
    }, (err, results) => {
      if (err) {
        return next(err);
      }
      
      stats = {
        totalUsers: results.totalUsers,
        activeUsers: results.activeUsers,
        inactiveUsers: results.inactiveUsers,
        usersNotChangedPassword: results.usersNotChangedPassword,
        usersNotChangedPasswordLevel2: results.usersNotChangedPasswordLevel2,
        usersWithWrongPasswordLevel2: results.usersWithWrongPasswordLevel2,
        recentUsers: results.recentUsers,
        todayUsers: results.todayUsers,
        generatedAt: Date.now()
      };
      
      next(null, {
        code: CONSTANTS.CODE.SUCCESS,
        data: stats,
        message: {
          head: 'Thành công',
          body: 'Lấy thống kê người dùng thành công'
        }
      });
    });
  };

  async.waterfall([getUserStats], (err, data) => {
    if (_.isError(err)) {
      console.error('Get user stats error:', err);
    }

    err && _.isError(err) && (data = {
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR || {
        head: 'Thông báo',
        body: 'Lỗi hệ thống'
      }
    });

    res.json(data || err);
  });
};
