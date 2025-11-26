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
  const folderName = _.get(req, 'body.name', '').trim();
  const parentId = _.get(req, 'body.parent', null);
  const accessUsers = _.get(req, 'body.accessUsers', []);

  let parentFolder = null;
  let newFolder = null;

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS,
      });
    }
    
    if (!folderName) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Tên thư mục không được để trống'
        },
      });
    }

    // Kiểm tra ký tự đặc biệt không hợp lệ trong tên thư mục
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(folderName)) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: {
          head: 'Thông báo',
          body: 'Tên thư mục chứa ký tự không hợp lệ',
        },
      });
    }

    next();
  };

 

  const getParentFolder = (next) => {
    if (!parentId) {
      return next();
    }

    FolderModel.findOne({
      _id: parentId,
      status: 1,
      $or: [
        { ownerId: userId },
        { accessUsers: userId }
      ]
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
            body: 'Thư mục cha không tồn tại hoặc bạn không có quyền truy cập'
          },
        });
      }
      parentFolder = result;
      next();
    });
  };

  const checkDuplicateName = (next) => {
    const query = {
      name: folderName,
      ownerId: userId,
      status: 1
    };
    
    if (parentId) {
      query.parentId = parentId;
    } else {
      query.parentId = null;
    }
    if(accessUsers && accessUsers.length > 0) {
      query.accessUsers = accessUsers;
    }
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
              body: 'Đã tồn tại thư mục với tên này trong thư mục hiện tại'
            },
          });
        }
        next();
      });
  };

  const createFolderInDB = (next) => {
    const folderPath = parentFolder ? `${parentFolder.path}/${folderName}` : `/${folderName}`;
    
    const folderData = {
      name: folderName,
      ownerId: userId,
      parentId: parentId || null,
      path: folderPath,
      accessUsers: accessUsers,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    FolderModel.create(folderData, (err, result) => {
      if (err) {
        return next(err);
      }
      newFolder = result;
      next();
    });
  };

  const createPhysicalFolder = (next) => {
    // Tạo đường dẫn vật lý
    const basePath = path.join(process.cwd(), 'public', 'uploads');
    let physicalPath;
    
    if (parentFolder) {
      // Nếu có thư mục cha, tạo trong đường dẫn của thư mục cha
      physicalPath = path.join(basePath, parentFolder.path, folderName);
    } else {
      // Nếu không có thư mục cha, tạo trong thư mục gốc
      physicalPath = path.join(basePath, folderName);
    }

    // Tạo thư mục vật lý
    fs.mkdir(physicalPath, { recursive: true }, (err) => {
      if (err) {
        console.error('Failed to create physical folder:', err);
        // Nếu tạo thư mục vật lý thất bại, xóa bản ghi trong DB
        FolderModel.deleteOne({ _id: newFolder._id }, (deleteErr) => {
          if (deleteErr) {
            console.error('Failed to cleanup folder record:', deleteErr);
          }
        });
        return next({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: 'Không thể tạo thư mục vật lý',
        });
      }
      next();
    });
  };

  const logFolderCreation = (next) => {
    // Populate owner và accessUsers trước khi trả về
    FolderModel.findById(newFolder._id)
      .populate('ownerId', 'name email username avatar')
      .populate('accessUsers', 'name email username avatar')
      .exec((err, populatedFolder) => {
        if (err) {
          return next(err);
        }
        
        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          message: {
            head: 'Thành công',
            body: 'Tạo thư mục thành công'
          },
          data: {
            id: populatedFolder._id,
            name: populatedFolder.name,
            path: populatedFolder.path,
            parentId: populatedFolder.parentId,
            owner: populatedFolder.ownerId,
            accessUsers: populatedFolder.accessUsers,
            createdAt: populatedFolder.createdAt
          }
        });
      });

    SystemLog.create(
      {
        user: userId,
        action: 'create_folder',
        description: `User created folder: ${folderName}`,
        data: {
          folderId: newFolder._id,
          folderName: folderName,
          parentId: parentId,
          platform: platform,
          userAgent: req.headers['user-agent'] || '',
          ip: req.headers.ip || req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to log folder creation:', err);
        }
      }
    );
  };

  async.waterfall([
    checkParams, 
    getParentFolder, 
    checkDuplicateName, 
    createFolderInDB, 
    createPhysicalFolder, 
    logFolderCreation
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
