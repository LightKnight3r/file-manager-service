const _ = require('lodash');
const jwt = require('jsonwebtoken');
const config = require('config');
const CONSTANTS = require('../const');
const MESSAGES = require('../message');

module.exports = (req, res, next) => {
  const user = req.user;
  const tokenLevel2 = req.headers['token-level-2'] || '';
  if (!user) {
    return res.status(401).json({
      code: CONSTANTS.CODE.UNAUTHORIZED,
      message: {
        head: 'Unauthorized',
        body: 'User not authenticated'
      }
    });
  }
  if(!tokenLevel2) {
    return res.status(403).json({
      code: CONSTANTS.CODE.ACCESS_DENINED,
      message: {
        head: 'Thông báo',
        body: 'Yêu cầu Mã xác thực cấp 2'
      }
    });
  }


  // Xác thực JWT token level 2
  try {
    const jwtSecret = config.secretKey || 'default-secret-key';
    const decoded = jwt.verify(tokenLevel2, jwtSecret);
    
    // Kiểm tra xem token có phải của user hiện tại không
    const currentUserId = user.id;
    if (decoded.userId !== currentUserId) {
      return res.status(403).json({
        code: CONSTANTS.CODE.ACCESS_DENINED,
        message: {
          head: 'Thông báo',
          body: 'Mã xác thực không hợp lệ'
        }
      });
    }

    // Kiểm tra xem token có phải là Mã xác thực cấp 2 không
    if (!decoded.level2Verified) {
      return res.status(403).json({
        code: CONSTANTS.CODE.ACCESS_DENINED,
        message: {
          head: 'Thông báo',
          body: 'Mã không phải là Mã xác thực cấp 2'
        }
      });
    }

    // Token hợp lệ, gắn thông tin vào req để sử dụng sau này
    req.level2Token = decoded;
    
  } catch (error) {
    // Xử lý các lỗi JWT
    let errorMessage = 'Mã xác thực cấp 2 không hợp lệ';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Mã xác thực cấp 2 đã hết hạn, vui lòng xác thực lại';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Mã xác thực cấp 2 không đúng định dạng';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Mã xác thực cấp 2 chưa có hiệu lực';
    }

    return res.status(403).json({
      code: CONSTANTS.CODE.ACCESS_DENINED,
      message: {
        head: 'Thông báo',
        body: errorMessage
      }
    });
  }

  next();
};
