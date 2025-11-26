const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../../../models/user');
const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const SystemLog = require('../../../models/systemLog');
const FolderModel = require('../../../models/folder');
const FileModel = require('../../../models/file');

module.exports = (req, res) => {

  let fileName = req.file ? req.file.filename : ''
  const folderId = _.get(req, 'body.folder', null); // ID của thư mục cha
  const userId = req.user.id || '';

  const checkParams = (next) => {
    if(!req.file || !folderId || !userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS
      })
    }
    next();
  }

  const checkFolderExists = (next) => {
    FolderModel.findById(folderId).exec((err, folder) => {
      if (err) {
        return next(err);
      }
      if (!folder) {
        return next({
          code: CONSTANTS.CODE.WRONG_PARAMS,
          message: 'Thư mục không tồn tại'
        });
      }
      
      // Kiểm tra quyền truy cập - user phải là owner hoặc có trong accessUsers
      const hasAccess = folder.ownerId.toString() === userId || 
                       folder.accessUsers.some(accessUserId => accessUserId.toString() === userId);
      
      if (!hasAccess) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: 'Không có quyền truy cập thư mục này'
        });
      }
      
      next(null, folder);
    });
  };

  const moveFileAndSaveToDb = (folder, next) => {
    const originalName = req.file.originalname;
    const fileExtension = path.extname(originalName);
    const fileName = req.file.filename;
    const tempFilePath = req.file.path;
    
    // Tạo đường dẫn thư mục đích theo cấu trúc: uploads/folderId/
    const destinationDir = path.join('./public/uploads', folderId);
    const destinationPath = path.join(destinationDir, fileName);
    
    // Tạo thư mục đích nếu chưa tồn tại
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    
    // Di chuyển file từ temp sang thư mục đích
    fs.rename(tempFilePath, destinationPath, (err) => {
      if (err) {
        return next(err);
      }
      
      // Tạo bản ghi file trong database
      const fileData = {
        name: originalName,
        ownerId: userId,
        folderId: folderId,
        url: `/uploads/${folderId}/${fileName}`,
        extension: fileExtension,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
      
      const newFile = new FileModel(fileData);
      newFile.save((err, savedFile) => {
        if (err) {
          // Nếu lưu DB thất bại, xóa file đã upload
          fs.unlink(destinationPath, () => {});
          return next(err);
        }
        
        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          message: 'Tải file thành công',
          data: {
            id: savedFile._id,
            name: savedFile.name,
            url: savedFile.url,
            extension: savedFile.extension,
            mimeType: savedFile.mimeType,
            size: savedFile.size,
            folderId: savedFile.folderId,
            createdAt: savedFile.createdAt
          }
        });
      });
    });
  };

  async.waterfall([
    checkParams,
    checkFolderExists,
    moveFileAndSaveToDb
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('Upload file error:', err);
      
      // Xóa file tạm nếu có lỗi và file vẫn tồn tại
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
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
