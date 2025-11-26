const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const SystemLog = require('../../../models/systemLog');
const FolderModel = require('../../../models/folder');

module.exports = (req, res) => {
  const userId = req.user.id || '';
  const platform = _.get(req, 'body.platform', 'web');
  const folderId = _.get(req, 'body.id', '');
  const newFolderName = _.get(req, 'body.name', '').trim();
  const accessUsers = _.get(req, 'body.accessUsers', []);
  
  let currentFolder = null;
  let updatedFolder = null;
  let isNameChanged = false;

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS,
      });
    }
    
    if (!folderId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'ID thư mục không được để trống'
        },
      });
    }

    // Nếu có tên mới, kiểm tra tính hợp lệ
    if (newFolderName) {
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(newFolderName)) {
        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: {
            head: 'Thông báo',
            body: 'Tên thư mục chứa ký tự không hợp lệ'
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

  const getCurrentFolder = (next) => {
    FolderModel.findOne({
      _id: folderId,
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
            body: 'Thư mục không tồn tại hoặc bạn không có quyền chỉnh sửa'
          },
        });
      }
      currentFolder = result;
      
      // Kiểm tra xem có đổi tên không
      if (newFolderName && newFolderName !== currentFolder.name) {
        isNameChanged = true;
      }
      
      next();
    });
  };

  const getParentFolder = (next) => {
    if (!currentFolder.parentId) {
      return next();
    }

    FolderModel.findOne({
      _id: currentFolder.parentId,
      status: 1
    })
    .lean()
    .exec((err, result) => {
      if (err) {
        return next(err);
      }
      parentFolder = result;
      next();
    });
  };

  const checkDuplicateName = (next) => {
    // Chỉ kiểm tra trùng tên nếu có đổi tên
    if (!isNameChanged) {
      return next();
    }

    const query = {
      name: newFolderName,
      status: 1,
      _id: { $ne: folderId }, // Loại trừ chính thư mục đang sửa
      parentId: currentFolder.parentId
    };

    FolderModel.findOne(query)
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
              body: `Thư mục với tên "${newFolderName}" đã tồn tại trong thư mục cha`
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
            body: 'Danh sách quyền truy cập chứa người dùng không hợp lệ'
          },
        });
      }
      
      next();
    });
  };

  // Bỏ qua việc đổi tên thư mục vật lý - chỉ đổi tên trong DB
  const skipPhysicalRename = (next) => {
    next();
  };

  const updateFolderInDB = (next) => {
    const updateData = {
      updatedAt: Date.now()
    };

    // Chỉ cập nhật tên, không thay đổi path
    if (isNameChanged) {
      updateData.name = newFolderName;
      // Giữ nguyên path cũ
    }

    // Nếu có cập nhật quyền truy cập
    if (accessUsers !== undefined) {
      updateData.accessUsers = accessUsers;
    }

    FolderModel.findByIdAndUpdate(
      folderId,
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
      updatedFolder = result;
      next();
    });
  };

  // Bỏ qua việc cập nhật path của các thư mục con - giữ nguyên path
  const skipChildrenPathUpdate = (next) => {
    next();
  };

  const logFolderModification = (next) => {
    const changes = [];
    
    if (isNameChanged) {
      changes.push(`name: ${currentFolder.name} -> ${newFolderName}`);
    }
    
    if (accessUsers !== undefined) {
      changes.push(`accessUsers updated`);
    }

    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      message: {
        head: 'Thành công',
        body: 'Cập nhật thư mục thành công'
      },
      data: {
        id: updatedFolder._id,
        name: updatedFolder.name,
        path: updatedFolder.path, // Giữ nguyên path cũ
        parentId: updatedFolder.parentId,
        owner: updatedFolder.ownerId, // Trả về owner đã populate
        accessUsers: updatedFolder.accessUsers, // Trả về accessUsers đã populate
        createdAt: updatedFolder.createdAt,
        updatedAt: updatedFolder.updatedAt
      }
    });

    SystemLog.create(
      {
        user: userId,
        action: 'modify_folder',
        description: `User modified folder name only: ${changes.join(', ')}`,
        data: {
          folderId: folderId,
          oldName: currentFolder.name,
          newName: newFolderName || currentFolder.name,
          path: updatedFolder.path, // Path không thay đổi
          accessUsers: accessUsers,
          changes: changes,
          platform: platform,
          userAgent: req.headers['user-agent'] || '',
          ip: req.headers.ip || req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to log folder modification:', err);
        }
      }
    );
  };

  async.waterfall([
    checkParams,
    getCurrentFolder,
    getParentFolder,
    checkDuplicateName,
    validateAccessUsers,
    skipPhysicalRename,
    updateFolderInDB,
    skipChildrenPathUpdate,
    logFolderModification
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Modify folder error:', err);
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
