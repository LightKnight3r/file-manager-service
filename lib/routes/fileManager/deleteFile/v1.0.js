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
  
  let currentFile = null;

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

    next();
  };

  const getCurrentFile = (next) => {
    FileModel.findOne({
      _id: fileId,
      status: 1,
      ownerId: userId // Chỉ chủ sở hữu mới được xóa
    })
    .populate('folderId', 'name path')
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
            body: 'File không tồn tại hoặc bạn không có quyền xóa'
          },
        });
      }
      currentFile = result;
      next();
    });
  };

  // Xóa file vật lý từ hệ thống
  const deletePhysicalFile = (next) => {
    if (!currentFile.url) {
      return next();
    }

    // Tạo đường dẫn tuyệt đối từ URL
    const filePath = path.join(process.cwd(), 'public', currentFile.url);
    
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error(`Failed to delete file ${filePath}:`, err);
      }
      next();
    });
  };

  // Xóa file khỏi database (soft delete)
  const deleteFileFromDB = (next) => {
    FileModel.findByIdAndUpdate(
      fileId,
      {
        status: 0,
        deletedAt: Date.now(),
        deletedBy: userId
      }
    ).exec((err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  };

  const logFileDeletion = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      message: {
        head: 'Thành công',
        body: 'Xóa file thành công'
      },
      data: {
        deletedFile: {
          id: currentFile._id,
          name: currentFile.name,
          url: currentFile.url,
          size: currentFile.size,
          mimeType: currentFile.mimeType,
          extension: currentFile.extension,
          folder: currentFile.folderId ? {
            id: currentFile.folderId._id,
            name: currentFile.folderId.name,
            path: currentFile.folderId.path
          } : null
        }
      }
    });

    // Log hành động xóa file
    SystemLog.create(
      {
        user: userId,
        action: 'delete_file',
        description: `User deleted file: ${currentFile.name}`,
        data: {
          fileId: fileId,
          fileName: currentFile.name,
          fileUrl: currentFile.url,
          fileSize: currentFile.size,
          mimeType: currentFile.mimeType,
          extension: currentFile.extension,
          folderId: currentFile.folderId ? currentFile.folderId._id : null,
          folderName: currentFile.folderId ? currentFile.folderId.name : null,
          platform: platform,
          userAgent: req.headers['user-agent'] || '',
          ip: req.headers.ip || req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to log file deletion:', err);
        }
      }
    );
  };

  async.waterfall([
    checkParams,
    getCurrentFile,
    deletePhysicalFile,
    deleteFileFromDB,
    logFileDeletion
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Delete file error:', err);
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
