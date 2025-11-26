const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const SystemLog = require('../../../models/systemLog');
const FileModel = require('../../../models/file');

module.exports = (req, res) => {
  const userId = req.user.id || '';
  const platform = _.get(req, 'body.platform', 'web');
  const fileId = _.get(req, 'body.id', '');
  const newFileName = _.get(req, 'body.name', '').trim();
  const accessUsers = _.get(req, 'body.accessUsers', []);
  
  let currentFile = null;
  let updatedFile = null;
  let isNameChanged = false;

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS,
      });
    }
    
    if (!fileId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'ID file không được để trống'
        },
      });
    }

    // Nếu có tên mới, kiểm tra tính hợp lệ
    if (newFileName) {
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(newFileName)) {
        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: {
            head: 'Thông báo',
            body: 'Tên file chứa ký tự không hợp lệ'
          },
        });
      }
    }

    // Kiểm tra accessUsers phải là mảng
    if (accessUsers && !Array.isArray(accessUsers)) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Danh sách quyền truy cập không hợp lệ'
        },
      });
    }

    next();
  };

  const getCurrentFile = (next) => {
    FileModel.findOne({
      _id: fileId,
      status: 1,
      ownerId: userId // Chỉ chủ sở hữu mới được chỉnh sửa
    })
    .lean()
    .exec((err, result) => {
      if (err) {
        return next(err);
      }
      if (!result) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: {
            head: 'Thông báo',
            body: 'File không tồn tại hoặc bạn không có quyền chỉnh sửa'
          },
        });
      }
      currentFile = result;
      
      // Kiểm tra xem có đổi tên không
      if (newFileName && newFileName !== currentFile.name) {
        isNameChanged = true;
      }
      
      next();
    });
  };

  // Bỏ qua bước lấy parent folder vì file không cần
  const skipGetParentFolder = (next) => {
    next();
  };

  const processFileName = (next) => {
    // Chỉ xử lý nếu có đổi tên
    if (!isNameChanged) {
      return next();
    }

    // Kiểm tra nếu tên file mới không có extension
    let finalFileName = newFileName;
    const newFileExtension = path.extname(newFileName);
    
    if (!newFileExtension && currentFile.extension) {
      // Nếu tên mới không có extension nhưng file gốc có, thì gắn extension cũ vào
      finalFileName = newFileName + currentFile.extension;
    }
    
    // Cập nhật lại tên file để sử dụng trong các bước tiếp theo
    req.body.name = finalFileName;
    
    next();
  };

  const checkDuplicateName = (next) => {
    // Chỉ kiểm tra trùng tên nếu có đổi tên
    if (!isNameChanged) {
      return next();
    }

    // Sử dụng tên file đã được xử lý
    const finalFileName = _.get(req, 'body.name', '').trim();

    const query = {
      name: finalFileName,
      status: 1,
      _id: { $ne: fileId }, // Loại trừ chính file đang sửa
      folderId: currentFile.folderId // Kiểm tra trong cùng thư mục
    };

    FileModel.findOne(query)
      .lean()
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        if (result) {
          return next({
            code: CONSTANTS.CODE.FAIL,
            message: {
              head: 'Thông báo',
              body: `File với tên "${finalFileName}" đã tồn tại trong thư mục này`
            },
          });
        }
        next();
      });
  };

  const validateAccessUsers = (next) => {
    if (!accessUsers || accessUsers.length === 0) {
      return next();
    }

    // Kiểm tra tất cả user ID có tồn tại không
    User.find({
      _id: { $in: accessUsers },
      status: 1
    })
    .select('_id')
    .lean()
    .exec((err, validUsers) => {
      if (err) {
        return next(err);
      }
      
      const validUserIds = validUsers.map(user => user._id.toString());
      const invalidUsers = accessUsers.filter(userId => !validUserIds.includes(userId));
      
      if (invalidUsers.length > 0) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: {
            head: 'Thông báo',
            body: 'Một số người dùng trong danh sách quyền truy cập không tồn tại'
          },
        });
      }
      
      next();
    });
  };

  // Bỏ qua việc đổi tên file vật lý - chỉ đổi tên trong DB
  const skipPhysicalRename = (next) => {
    next();
  };

  const updateFileInDB = (next) => {
    const updateData = {
      updatedAt: Date.now()
    };

    // Chỉ cập nhật tên, không thay đổi path
    if (isNameChanged) {
      const finalFileName = _.get(req, 'body.name', '').trim();
      updateData.name = finalFileName;
      // Giữ nguyên path cũ
    }

    // Nếu có cập nhật quyền truy cập
    if (accessUsers !== undefined) {
      updateData.accessUsers = accessUsers;
    }

    FileModel.findByIdAndUpdate(
      fileId,
      updateData,
      { new: true }
    )
    .populate('ownerId', 'name email avatar')
    .populate('accessUsers', 'name email avatar')
    .lean()
    .exec((err, result) => {
      if (err) {
        return next(err);
      }
      updatedFile = result;
      next();
    });
  };

  const logFileModification = (next) => {
    const changes = [];
    
    if (isNameChanged) {
      const finalFileName = _.get(req, 'body.name', '').trim();
      changes.push(`name: ${currentFile.name} -> ${finalFileName}`);
    }
    
    if (accessUsers !== undefined) {
      changes.push(`accessUsers updated`);
    }

    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      message: {
        head: 'Thành công',
        body: 'Cập nhật file thành công'
      },
      data: {
        id: updatedFile._id,
        name: updatedFile.name,
        path: updatedFile.path, // Giữ nguyên path cũ
        folderId: updatedFile.folderId,
        owner: updatedFile.ownerId, // Trả về owner đã populate
        accessUsers: updatedFile.accessUsers, // Trả về accessUsers đã populate
        size: updatedFile.size,
        mimeType: updatedFile.mimeType,
        extension: updatedFile.extension,
        createdAt: updatedFile.createdAt,
        updatedAt: updatedFile.updatedAt
      }
    });

    SystemLog.create(
      {
        user: userId,
        action: 'modify_file',
        description: `User modified file name only: ${changes.join(', ')}`,
        data: {
          fileId: fileId,
          oldName: currentFile.name,
          newName: (isNameChanged ? _.get(req, 'body.name', '').trim() : null) || currentFile.name,
          path: updatedFile.path, // Path không thay đổi
          accessUsers: accessUsers,
          changes: changes,
          platform: platform,
          userAgent: req.headers['user-agent'] || '',
          ip: req.headers.ip || req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to log file modification:', err);
        }
      }
    );
  };

  async.waterfall([
    checkParams,
    getCurrentFile,
    skipGetParentFolder,
    processFileName,
    checkDuplicateName,
    validateAccessUsers,
    skipPhysicalRename,
    updateFileInDB,
    logFileModification
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Modify file error:', err);
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
