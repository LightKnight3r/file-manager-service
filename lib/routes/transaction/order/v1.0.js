const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const OrderSystem = require('../../../models/ordersystem');
const OrderBike = require('../../../models/orderbike');
const ms = require('ms');

module.exports = (req, res) => {

  const userId = req.user.id;
  const type = req.body.type || 'week';
  const options = [
   'week','month','day', 'custom'
  ]
  const endTime = _.get(req, 'body.endTime', Date.now());
  let startTime = req.body.startTime || null;
  let totalBikeCount = 0;
  let bikeByGroup = [];

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

  const statisticBike = (next) => {
    // Định nghĩa các nhóm dịch vụ
    const serviceGroups = {
      '0': {
        name: 'Đang tìm tài xế',
        status: [CONSTANTS.ORDER_BIKE_STATUS.LOOKING_SHIPPER]
      },
      '1': {
        name: 'Đã nhận đơn',
        status: [CONSTANTS.ORDER_BIKE_STATUS.FOUND_SHIPPER]
      },
      '2': {
        name: 'Đang chở khách',
        status: [CONSTANTS.ORDER_BIKE_STATUS.SHIPPING, CONSTANTS.ORDER_BIKE_STATUS.RETURNING]
      },
      '3': {
        name: 'Hoàn thành',
        status: [CONSTANTS.ORDER_BIKE_STATUS.DONE, CONSTANTS.ORDER_BIKE_STATUS.RETURN_DONE]
      },
      '4': {
        name: 'Thất bại',
        status: [CONSTANTS.ORDER_BIKE_STATUS.CAN_NOT_FIND_SHIPPER, CONSTANTS.ORDER_BIKE_STATUS.CAN_NOT_TAKE_ORDER]
      },
      '5': {
        name: 'Đã hủy',
        status: [CONSTANTS.ORDER_BIKE_STATUS.REJECT]
      }
    };

    OrderBike.aggregate([
      {
        $match: {
          updatedAt: {
            $gte: startTime.getTime(),
            $lte: new Date(endTime).getTime()
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).exec((err, results) => {
      if (err) {
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }

      // Tạo map để dễ tra cứu kết quả theo status
      const resultMap = {};
      results.forEach(result => {
        resultMap[result._id] = result.count;
      });

      // Xử lý dữ liệu trả về theo nhóm
      const orderByGroup = [];
      let totalOrderCount = 0;

      // Nhóm lại theo service groups
      Object.keys(serviceGroups).forEach(groupKey => {
        const group = serviceGroups[groupKey];
        let groupOrderCount = 0;

        group.status.forEach(status => {
          const statusCount = resultMap[status] || 0;
          groupOrderCount += statusCount;
        });

        // Thêm nhóm vào kết quả
        orderByGroup.push({
          groupKey: groupKey,
          groupName: group.name,
          orderCount: groupOrderCount,
        });

        totalOrderCount += groupOrderCount;
      });

      // Sắp xếp theo số lượng đơn hàng giảm dần
      orderByGroup.sort((a, b) => b.orderCount - a.orderCount);
      totalBikeCount = totalOrderCount;
      bikeByGroup = orderByGroup;
      next();
    });
  };

  const statistics = (next) => {
    // Định nghĩa các nhóm dịch vụ
    const serviceGroups = {
      '0': {
        name: 'Đang tìm tài xế',
        status: [CONSTANTS.ORDER_STATUS.LOOKING_SHIPPER]
      },
      '1': {
        name: 'Đã nhận đơn',
        status: [CONSTANTS.ORDER_STATUS.FOUND_SHIPPER]
      },
      '2': {
        name: 'Đang giao hàng',
        status: [CONSTANTS.ORDER_STATUS.SHIPPING, CONSTANTS.ORDER_STATUS.RETURNING, CONSTANTS.ORDER_STATUS.RETURN_ORDER]
      },
      '3': {
        name: 'Hoàn thành',
        status: [CONSTANTS.ORDER_STATUS.DONE, CONSTANTS.ORDER_STATUS.RETURN_ORDER_DONE, CONSTANTS.ORDER_STATUS.RETURN_DONE]
      },
      '4': {
        name: 'Thất bại',
        status: [CONSTANTS.ORDER_STATUS.CAN_NOT_FIND_SHIPPER, CONSTANTS.ORDER_STATUS.CAN_NOT_TAKE_ORDER]
      },
      '5': {
        name: 'Đã hủy',
        status: [CONSTANTS.ORDER_STATUS.REJECT]
      }
    };

    OrderSystem.aggregate([
      {
        $match: {
          updatedAt: {
            $gte: startTime.getTime(),
            $lte: new Date(endTime).getTime()
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).exec((err, results) => {
      if (err) {
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }

      // Tạo map để dễ tra cứu kết quả theo status
      const resultMap = {};
      results.forEach(result => {
        resultMap[result._id] = result.count;
      });

      // Xử lý dữ liệu trả về theo nhóm
      const orderByGroup = [];
      let totalOrderCount = 0;

      // Nhóm lại theo service groups
      Object.keys(serviceGroups).forEach(groupKey => {
        const group = serviceGroups[groupKey];
        let groupOrderCount = 0;

        group.status.forEach(status => {
          const statusCount = resultMap[status] || 0;
          groupOrderCount += statusCount;
        });

        // Thêm nhóm vào kết quả
        orderByGroup.push({
          groupKey: groupKey,
          groupName: group.name,
          orderCount: groupOrderCount,
        });

        totalOrderCount += groupOrderCount;
      });

      // Sắp xếp theo số lượng đơn hàng giảm dần
      orderByGroup.sort((a, b) => b.orderCount - a.orderCount);

      next(null, {
        code: CONSTANTS.CODE.SUCCESS,
        data: {
          title: 'Thống kê đơn hàng',
          type: type,
          totalOrderCount: totalOrderCount,
          orderByGroup: orderByGroup,
          totalBikeCount: totalBikeCount,
          bikeByGroup: bikeByGroup,
          timeRange: {
            startTime: moment(startTime).utcOffset('+07:00').format('DD-MM-YYYY HH:mm:ss'),
            endTime: moment(endTime).utcOffset('+07:00').format('DD-MM-YYYY HH:mm:ss'),
            type: type
          }
        }
      });
    });
  };

  async.waterfall([
    checkParams, 
    calculateTimeRange,
    statisticBike,
    statistics
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Expense statistics error:', err);
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
