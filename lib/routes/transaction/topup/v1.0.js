const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const TransactionLog = require('../../../models/transactionLog');

module.exports = (req, res) => {

  const userId = req.user.id;
  const type = req.body.type || 'week';
  const options = [
   'week','month','day'
  ]
  const endTime = _.get(req, 'body.endTime', Date.now());
  let startTime;

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
    next();
  }
  const calculateTimeRange = (next) => {
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
    // Định nghĩa các nhóm nạp tiền
    const serviceGroups = {
      'driver': {
        name: 'Tài xế nạp tiền',
        types: [
          CONSTANTS.TRANSACTION.TOPUP,
          CONSTANTS.TRANSACTION.TOPUP_PARTNER
        ]
      },
      'customer': {
        name: 'Khách hàng nạp tiền',
        types: [
          CONSTANTS.TRANSACTION.SHOP_TOPUP
        ]
      },
      'merchant': {
        name: 'Cửa hàng nạp tiền',
        types: [
          CONSTANTS.TRANSACTION.MERCHANT_TOPUP
        ]
      },
      'staff': {
        name: 'Nhân viên Heycare nạp tiền',
        types: [
          CONSTANTS.TRANSACTION.STAFF_TOPUP
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
          _id: {
            type: '$data.type',
            gateway: '$data.gateway'
          },
          totalAmount: { $sum: '$data.amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]).exec((err, results) => {
      if (err) {
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }

      // Tạo map để dễ tra cứu kết quả theo type và gateway
      const resultMap = {};
      results.forEach(result => {
        const type = result._id.type;
        const gateway = result._id.gateway || 'unknown';
        
        if (!resultMap[type]) {
          resultMap[type] = {
            totalAmount: 0,
            transactionCount: 0,
            gateways: {}
          };
        }
        
        resultMap[type].totalAmount += result.totalAmount;
        resultMap[type].transactionCount += result.transactionCount;
        resultMap[type].gateways[gateway] = {
          totalAmount: result.totalAmount,
          transactionCount: result.transactionCount
        };
      });

      // Xử lý dữ liệu trả về theo nhóm
      const chargingByGroup = [];
      let totalAmount = 0;
      let totalTransactionCount = 0;

      // Thống kê riêng từng type và gateway trước
      const chargingByType = Object.keys(resultMap).map(type => ({
        type: type,
        totalAmount: resultMap[type].totalAmount,
        transactionCount: resultMap[type].transactionCount,
        gateways: Object.keys(resultMap[type].gateways).map(gateway => ({
          gateway: gateway,
          totalAmount: resultMap[type].gateways[gateway].totalAmount,
          transactionCount: resultMap[type].gateways[gateway].transactionCount
        })).sort((a, b) => b.totalAmount - a.totalAmount)
      })).sort((a, b) => b.totalAmount - a.totalAmount);

      // Sau đó nhóm lại theo service groups
      Object.keys(serviceGroups).forEach(groupKey => {
        const group = serviceGroups[groupKey];
        let groupAmount = 0;
        let groupTransactionCount = 0;
        const groupGateways = {};

        group.types.forEach(type => {
          const typeData = resultMap[type];
          if (typeData) {
            groupAmount += typeData.totalAmount;
            groupTransactionCount += typeData.transactionCount;
            
            // Tổng hợp gateway cho cả nhóm
            Object.keys(typeData.gateways).forEach(gateway => {
              if (!groupGateways[gateway]) {
                groupGateways[gateway] = {
                  totalAmount: 0,
                  transactionCount: 0
                };
              }
              groupGateways[gateway].totalAmount += typeData.gateways[gateway].totalAmount;
              groupGateways[gateway].transactionCount += typeData.gateways[gateway].transactionCount;
            });
          }
        });

        // Chuyển đổi groupGateways thành mảng và sắp xếp
        const gatewaysSummary = Object.keys(groupGateways).map(gateway => ({
          gateway: gateway,
          name: CONSTANTS.PAYMENT_GATEWAYS[gateway] || 'gateway',
          totalAmount: groupGateways[gateway].totalAmount,
          transactionCount: groupGateways[gateway].transactionCount
        })).sort((a, b) => b.totalAmount - a.totalAmount);

        // Thêm nhóm vào kết quả (kể cả khi số tiền = 0)
        chargingByGroup.push({
          groupKey: groupKey,
          groupName: group.name,
          totalAmount: groupAmount,
          transactionCount: groupTransactionCount,
          gateways: gatewaysSummary
        });

        totalAmount += groupAmount;
        totalTransactionCount += groupTransactionCount;
      });

      // Sắp xếp theo số tiền nạp giảm dần
      chargingByGroup.sort((a, b) => b.totalAmount - a.totalAmount);

      next(null, {
        code: CONSTANTS.CODE.SUCCESS,
        data: {
          title: 'Báo cáo nạp tiền',
          totalAmount: totalAmount,
          totalTransactionCount: totalTransactionCount,
          chargingByGroup: chargingByGroup, // Nhóm lại theo danh mục
          startTime: moment(startTime).utcOffset('+07:00').format('YYYY-MM-DD HH:mm:ss'),
          endTime: moment(endTime).utcOffset('+07:00').format('YYYY-MM-DD HH:mm:ss')
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
