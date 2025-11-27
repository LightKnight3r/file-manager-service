const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const TransactionLog = require('../../../models/transactionLog');
const ms = require('ms');

module.exports = (req, res) => {

  const userId = req.user.id;
  const type = req.body.type || 'week';
  const options = [
   'week','month','day', 'custom'
  ]
  const endTime = _.get(req, 'body.endTime', Date.now());
  let startTime = req.body.startTime || null;

  const checkParams = (next) => {
    if(type && !options.includes(type)) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Lỗi tham số',
          body: `Tham số type không hợp lệ. Các giá trị hợp lệ là: ${options.join(', ')}`
        }
      });
    }
    if(type === 'custom' && !startTime) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Lỗi tham số',
          body: `Khi type là 'custom', tham số startTime là bắt buộc`
        }
      });
    }
    if(type !== 'custom' && startTime) {
      startTime = null;
    }

    if(startTime && startTime >= endTime) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Lỗi tham số',
          body: `Tham số startTime không hợp lệ. Vui lòng cung cấp timestamp hợp lệ`
        }
      });
    }
    if(startTime && endTime - startTime > ms('31 days')) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Lỗi tham số',
          body: `Tham số thời gian không hợp lệ. Vui lòng cung cấp khoảng thời gian tối đa là 31 ngày`
        }
      });
    }
    next();
  }
  const calculateTimeRange = (next) => {
    if(startTime) {
      startTime = new Date(startTime);
      return next();
    }
    const endDate = new Date(endTime);
    
    switch (type) {
      case 'week':
        startTime = new Date(endDate);
        // Tính ngày Thứ 2 của tuần (1 = Monday)
        const dayOfWeek = endDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Nếu là CN thì lùi 6 ngày, ngược lại lùi (dayOfWeek - 1) ngày
        startTime.setDate(endDate.getDate() - daysToMonday);
        break;
      case 'month':
        startTime = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'day':
        startTime = new Date(endDate);
        startTime.setHours(0, 0, 0, 0);
        break;
      default:
        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: {
            head: 'Lỗi tham số',
            body: `Tham số type không hợp lệ. Các giá trị hợp lệ là: ${options.join(', ')}`
          }
        });
    }
    
    // Set hours to 0 for week and month, but day already has it set
    if (type !== 'day') {
      startTime.setHours(0, 0, 0, 0);
    }

    next();
  };

  const statistics = (next) => {
    // Định nghĩa các nhóm dịch vụ
    const serviceGroups = {
      'order': {
        name: 'Doanh thu đơn hàng',
        types: [
          CONSTANTS.TRANSACTION.SERVICE_CHARGE_ORDER,
          CONSTANTS.TRANSACTION.RESOURCE_FEE,
          CONSTANTS.TRANSACTION.SMS_FEE
        ]
      },
      'delivery': {
        name: 'Doanh thu chuyến đi',
        types: [
          CONSTANTS.TRANSACTION.SERVICE_CHARGE_BIKE,
          CONSTANTS.TRANSACTION.RESOURCE_FEE_BIKE
        ]
      },
      'tickbox': {
        name: 'Doanh thu đơn tickbox',
        types: [
          CONSTANTS.TRANSACTION.SERVICE_CHARGE_TICKBOX
        ]
      },
      'hire_driver': {
        name: 'Doanh thu đơn lái xe hộ',
        types: [
          CONSTANTS.TRANSACTION.SERVICE_CHARGE_HIRE_DRIVER
        ]
      },
      'care_clean': {
        name: 'Doanh thu HeyCare + Dọn dẹp',
        types: [
          CONSTANTS.TRANSACTION.SERVICE_CHARGE_CARE,
          CONSTANTS.TRANSACTION.SERVICE_CHARGE_CLEAN
        ]
      }
    };

    // Lấy tất cả các loại giao dịch
    const allRevenueTypes = Object.values(serviceGroups).flatMap(group => group.types);

    TransactionLog.aggregate([
      {
        $match: {
          'data.type': {
            $in: allRevenueTypes
          },
          createdAt: {
            $gte: startTime.getTime(),
            $lte: new Date(endTime).getTime()
          }
        }
      },
      {
        $group: {
          _id: '$data.type',
          totalRevenue: { $sum: { $multiply: ['$data.amount', -1] } },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]).exec((err, results) => {
      if (err) {
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }

      // Tạo map để dễ tra cứu kết quả theo type
      const resultMap = {};
      results.forEach(result => {
        resultMap[result._id] = {
          totalRevenue: result.totalRevenue,
          transactionCount: result.transactionCount
        };
      });

      // Xử lý dữ liệu trả về theo nhóm
      const revenueByGroup = [];
      let totalRevenue = 0;
      let totalTransactionCount = 0;

      // Thống kê riêng từng type trước
      const revenueByType = results.map(item => ({
        type: item._id,
        totalRevenue: item.totalRevenue,
        transactionCount: item.transactionCount
      }));

      // Sau đó nhóm lại theo service groups
      Object.keys(serviceGroups).forEach(groupKey => {
        const group = serviceGroups[groupKey];
        let groupRevenue = 0;
        let groupTransactionCount = 0;
        const groupDetails = [];

        group.types.forEach(type => {
          const typeData = resultMap[type];
          if (typeData) {
            groupRevenue += typeData.totalRevenue;
            groupTransactionCount += typeData.transactionCount;
            groupDetails.push({
              type: type,
              totalRevenue: typeData.totalRevenue,
              transactionCount: typeData.transactionCount
            });
          }
        });

        // Thêm nhóm vào kết quả (kể cả khi doanh thu = 0)
        revenueByGroup.push({
          groupKey: groupKey,
          groupName: group.name,
          totalRevenue: groupRevenue,
          transactionCount: groupTransactionCount,
          details: groupDetails
        });

        totalRevenue += groupRevenue;
        totalTransactionCount += groupTransactionCount;
      });

      // Sắp xếp theo doanh thu giảm dần
      revenueByGroup.sort((a, b) => b.totalRevenue - a.totalRevenue);

      next(null, {
        code: CONSTANTS.CODE.SUCCESS,
        data: {
          title: 'Báo cáo doanh thu',
          totalRevenue: totalRevenue,
          totalTransactionCount: totalTransactionCount,
          revenueByGroup: revenueByGroup, // Nhóm lại theo danh mục
          startTime: moment(startTime).utcOffset('+07:00').format('DD-MM-YYYY HH:mm:ss'),
          endTime: moment(endTime).utcOffset('+07:00').format('DD-MM-YYYY HH:mm:ss')
        }
      });
    });
  };

  async.waterfall([
    checkParams, 
    calculateTimeRange,
    statistics
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Create folder error:', err);
    }

    err &&
      _.isError(err) &&
      (data = {
        code: CONSTANTS.CODE.SYSTEM_ERROR,
        message: MESSAGES.SYSTEM.ERROR,
      });

    res.json(data || err);
  });
};
