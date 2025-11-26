const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const SystemLog = require('../../../models/systemLog');
const FolderModel = require('../../../models/folder');
const FileModel = require('../../../models/file');

module.exports = (req, res) => {
  const userId = req.user.id || '';
  const platform = _.get(req, 'body.platform', 'web');
  const folderId = _.get(req, 'body.id', '');
  
  let currentFolder = null;
  let deletedFiles = [];
  let deletedFolders = [];

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
        }
      });
    }

    next();
  };

  const getCurrentFolder = (next) => {
    FolderModel.findOne({
      _id: folderId,
      status: 1,
      ownerId: userId // Chỉ chủ sở hữu mới được xóa
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
            body: 'Thư mục không tồn tại hoặc bạn không có quyền xóa'
          },
        });
      }
      currentFolder = result;
      next();
    });
  };

  // Hàm đệ quy để lấy tất cả thư mục con
  const getAllChildFolders = (folderId, next) => {
    FolderModel.find({
      parentId: folderId,
      status: 1
    })
    .lean()
    .exec((err, childFolders) => {
      if (err) {
        return next(err);
      }
      
      let allFolders = childFolders || [];
      
      if (childFolders && childFolders.length > 0) {
        // Đệ quy lấy các thư mục con của từng thư mục con
        async.map(childFolders, (folder, callback) => {
          getAllChildFolders(folder._id, (err, subFolders) => {
            if (err) return callback(err);
            callback(null, subFolders);
          });
        }, (err, results) => {
          if (err) return next(err);
          
          // Gộp tất cả kết quả
          results.forEach(subFolders => {
            allFolders = allFolders.concat(subFolders);
          });
          
          next(null, allFolders);
        });
      } else {
        next(null, allFolders);
      }
    });
  };

  // Lấy tất cả files trong thư mục và các thư mục con
  const getAllFiles = (next) => {
    // Đầu tiên lấy tất cả thư mục con
    getAllChildFolders(folderId, (err, childFolders) => {
      if (err) {
        return next(err);
      }
      
      // Tạo danh sách ID của tất cả thư mục (bao gồm thư mục gốc)
      const folderIds = [folderId];
      childFolders.forEach(folder => {
        folderIds.push(folder._id);
      });
      
      // Lưu danh sách thư mục con để xóa sau
      deletedFolders = childFolders;
      
      // Lấy tất cả files trong các thư mục này
      FileModel.find({
        folderId: { $in: folderIds },
        status: 1
      })
      .lean()
      .exec((err, files) => {
        if (err) {
          return next(err);
        }
        deletedFiles = files || [];
        next();
      });
    });
  };

  // Xóa files vật lý từ hệ thống
  const deletePhysicalFiles = (next) => {
    if (!deletedFiles || deletedFiles.length === 0) {
      return next();
    }

    async.eachLimit(deletedFiles, 5, (file, callback) => {
      if (!file.url) {
        return callback();
      }

      // Tạo đường dẫn tuyệt đối từ URL
      const filePath = path.join(process.cwd(), 'public', file.url);
      
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error(`Failed to delete file ${filePath}:`, err);
        }
        // Tiếp tục dù có lỗi (file có thể đã bị xóa trước đó)
        callback();
      });
    }, next);
  };

  // Xóa thư mục vật lý từ hệ thống
  const deletePhysicalFolder = (next) => {
    if (!currentFolder.path) {
      return next();
    }

    const folderPath = path.join(process.cwd(), 'public', currentFolder.path);
    
    // Xóa thư mục và tất cả nội dung bên trong
    const rimraf = require('rimraf'); // Thêm package này nếu chưa có
    
    // Fallback nếu không có rimraf, dùng fs.rmdir recursive
    if (fs.rmSync) {
      try {
        fs.rmSync(folderPath, { recursive: true, force: true });
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`Failed to delete folder ${folderPath}:`, err);
        }
      }
    } else if (fs.rmdirSync) {
      try {
        fs.rmdirSync(folderPath, { recursive: true });
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`Failed to delete folder ${folderPath}:`, err);
        }
      }
    }
    
    next();
  };

  // Xóa files khỏi database
  const deleteFilesFromDB = (next) => {
    if (!deletedFiles || deletedFiles.length === 0) {
      return next();
    }

    const fileIds = deletedFiles.map(file => file._id);
    
    FileModel.updateMany(
      { _id: { $in: fileIds } },
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

  // Xóa thư mục con khỏi database
  const deleteChildFoldersFromDB = (next) => {
    if (!deletedFolders || deletedFolders.length === 0) {
      return next();
    }

    const folderIds = deletedFolders.map(folder => folder._id);
    
    FolderModel.updateMany(
      { _id: { $in: folderIds } },
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

  // Xóa thư mục gốc khỏi database
  const deleteFolderFromDB = (next) => {
    FolderModel.findByIdAndUpdate(
      folderId,
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

  const logFolderDeletion = (next) => {
    const totalFilesDeleted = deletedFiles ? deletedFiles.length : 0;
    const totalFoldersDeleted = deletedFolders ? deletedFolders.length + 1 : 1; // +1 cho thư mục gốc

    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      message: {
        head: 'Thành công',
        body: 'Xóa thư mục thành công'
      },
      data: {
        deletedFolder: {
          id: currentFolder._id,
          name: currentFolder.name,
          path: currentFolder.path
        },
        statistics: {
          totalFoldersDeleted: totalFoldersDeleted,
          totalFilesDeleted: totalFilesDeleted
        }
      }
    });

    // Log hành động xóa
    SystemLog.create(
      {
        user: userId,
        action: 'delete_folder',
        description: `User deleted folder: ${currentFolder.name} and all its contents`,
        data: {
          folderId: folderId,
          folderName: currentFolder.name,
          folderPath: currentFolder.path,
          totalFoldersDeleted: totalFoldersDeleted,
          totalFilesDeleted: totalFilesDeleted,
          deletedFiles: deletedFiles.map(f => ({ id: f._id, name: f.name, url: f.url })),
          deletedFolders: deletedFolders.map(f => ({ id: f._id, name: f.name, path: f.path })),
          platform: platform,
          userAgent: req.headers['user-agent'] || '',
          ip: req.headers.ip || req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
        },
      },
      (err) => {
        if (err) {
          console.error('Failed to log folder deletion:', err);
        }
      }
    );
  };

  async.waterfall([
    checkParams,
    getCurrentFolder,
    getAllFiles,
    deletePhysicalFiles,
    deletePhysicalFolder,
    deleteFilesFromDB,
    deleteChildFoldersFromDB,
    deleteFolderFromDB,
    logFolderDeletion
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Delete folder error:', err);
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
