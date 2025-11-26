const _ = require('lodash');
const fs = require('fs');
const path = require('path');

const CONSTANTS = require('../../../const');
const MESSAGES = require('../../../message');
const FileModel = require('../../../models/file');
const FolderModel = require('../../../models/folder');
const { getFileStream, canViewFile } = require('../../../utils/fileUtils');

module.exports = (req, res) => {
  const fileId = req.params.id;
  const userId = req.user.id || '';

  const getFileById = (next) => {
    if (!fileId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: 'File ID is required'
      });
    }

    FileModel.findById(fileId).exec((err, file) => {
      if (err) {
        return next(err);
      }
      if (!file) {
        return res.status(404).send('File not found');
      }
      next(null, file);
    });
  };

  const checkFileAccess = (file, next) => {
    // Sử dụng utility function để kiểm tra quyền truy cập file
    if (canViewFile(req.user, file)) {
      return next(null, file);
    }

    // Nếu không có quyền trực tiếp với file, kiểm tra quyền với folder chứa file
    FolderModel.findById(file.folderId).exec((err, folder) => {
      if (err) {
        return next(err);
      }
      if (!folder) {
        return res.status(404).send('Folder not found');
      }

      const hasFolderAccess = folder.ownerId.toString() === userId || 
                             folder.accessUsers.some(accessUserId => accessUserId.toString() === userId);
      
      if (!hasFolderAccess) {
        return res.status(404).send('Forbidden - No access to view this file');
      }
      
      next(null, file);
    });
  };

  const streamFile = (file, next) => {
    // Tạo đường dẫn file từ URL trong database
    const filePath = path.join('./public', file.url);
    
    try {
      // Sử dụng utility function để tạo file stream
      const fileStream = getFileStream(filePath);
      
      // Set headers
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + encodeURIComponent(file.name) + '"'
      );
      
      // Handle stream errors
      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error streaming file');
        }
      });
      
      // Pipe the file stream to response
      fileStream.pipe(res);
      
      next(null, { success: true });
    } catch (error) {
      console.error('Stream file error:', error);
      if (error.message.includes('File not found')) {
        return res.status(404).send('File not found on disk');
      }
      return res.status(500).send('Error streaming file');
    }
  };

  async.waterfall([
    getFileById,
    checkFileAccess,
    streamFile
  ], (err, data) => {
    if (err && _.isError(err)) {
      console.error('View file error:', err);
      
      if (!res.headersSent) {
        return res.status(500).json({
          code: CONSTANTS.CODE.SYSTEM_ERROR,
          message: MESSAGES.SYSTEM.ERROR
        });
      }
    }
    
    if (err && err.code && !res.headersSent) {
      return res.status(400).json(err);
    }
  });
};
