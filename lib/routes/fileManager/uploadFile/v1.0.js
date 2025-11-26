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

  const folderId = _.get(req, 'body.folder', null); // ID của thư mục cha
  const userId = req.user.id || '';
  const accessUsers = _.get(req, 'body.accessUsers', []); // Danh sách user được truy cập file
  const customFileName = _.get(req, 'body.fileName', null); // Tên file tùy chỉnh do user gửi lên
  
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
          message: {
            head: 'Thông báo',
            body: 'Thư mục không tồn tại'
          }
        });
      }
      if( folder.status !== 1 ) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: {
            head: 'Thông báo',
            body: 'Thư mục đã bị xóa'
          }
        });
      }
      // Kiểm tra quyền truy cập - user phải là owner hoặc có trong accessUsers
      const hasAccess = folder.ownerId.toString() === userId || 
                       folder.accessUsers.some(accessUserId => accessUserId.toString() === userId);
      
      if (!hasAccess) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: {
            head: 'Thông báo',
            body: 'Bạn không có quyền tải file lên thư mục này'
          }
        });
      }
      
      next(null, folder);
    });
  };

  const checkDuplicateFileName = (folder, next) => {
    // Xác định tên file cuối cùng: sử dụng customFileName hoặc originalname
    let finalFileName = customFileName || req.file.originalname;
    
    // Kiểm tra file có cùng tên trong folder
    FileModel.findOne({
      folderId: folderId,
      name: finalFileName,
      status: 1 // Chỉ check file chưa bị xóa
    }).exec((err, existingFile) => {
      if (err) {
        return next(err);
      }
      
      if (existingFile) {
        return next({
          code: CONSTANTS.CODE.FAIL,
          message: {
            head: 'Thông báo',
            body: `File với tên "${finalFileName}" đã tồn tại trong thư mục này`
          }
        });
      }
      
      next(null, folder, finalFileName);
    });
  };

  const moveFileAndSaveToDb = (folder, finalFileName, next) => {
    let fileExtension = path.extname(finalFileName);
    const tempFileName = req.file.filename; // Tên file tạm từ multer
    const tempFilePath = req.file.path;
    
    // Nếu finalFileName không có extension, lấy từ originalname
    if (!fileExtension && req.file.originalname) {
      fileExtension = path.extname(req.file.originalname);
      // Gắn extension vào finalFileName nếu thiếu
      finalFileName = finalFileName + fileExtension;
    }
    
    // Tạo tên file vật lý duy nhất (giữ extension từ finalFileName)
    const timestamp = Date.now();
    const physicalFileName = finalFileName;
    
    // Sử dụng đường dẫn từ folder hoặc fallback về folderId
    const folderPath = folder.path || folderId;
    const destinationDir = path.join('./public/uploads', folderPath);
    const destinationPath = path.join(destinationDir, physicalFileName);
    
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
        name: finalFileName, // Sử dụng tên file cuối cùng (custom hoặc original)
        ownerId: userId,
        folderId: folderId,
        url: `/uploads/${folderPath}/${physicalFileName}`,
        extension: fileExtension,
        mimeType: req.file.mimetype,
        size: req.file.size,
        accessUsers
      };
      
      const newFile = new FileModel(fileData);
      newFile.save((err, savedFile) => {
        if (err) {
          // Nếu lưu DB thất bại, xóa file đã upload
          fs.unlink(destinationPath, () => {});
          return next(err);
        }
        
        // Populate owner và accessUsers trước khi trả về
        FileModel.findById(savedFile._id)
          .populate('ownerId', 'name email username avatar')
          .populate('accessUsers', 'name email username avatar')
          .exec((err, populatedFile) => {
            if (err) {
              return next(err);
            }
            
            next(null, {
              code: CONSTANTS.CODE.SUCCESS,
              message: {
                head: 'Thành công',
                body: 'Tải file lên thành công'
              },
              data: {
                id: populatedFile._id,
                name: populatedFile.name,
                extension: populatedFile.extension,
                mimeType: populatedFile.mimeType,
                size: populatedFile.size,
                folderId: populatedFile.folderId,
                owner: populatedFile.ownerId,
                accessUsers: populatedFile.accessUsers,
                createdAt: populatedFile.createdAt
              }
            });
          });
      });
    });
  };

  async.waterfall([
    checkParams,
    checkFolderExists,
    checkDuplicateFileName,
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
