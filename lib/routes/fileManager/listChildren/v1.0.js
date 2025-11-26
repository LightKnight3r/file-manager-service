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
  const folderId = _.get(req, 'body.folderId', null); // ID của thư mục cha

  let parentFolder = null;
  let folders = [];
  let files = [];

  const checkParams = (next) => {
    if (!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS,
      });
    }

    next();
  };

  const getParentFolder = (next) => {
    if (!folderId) {
      // Nếu không có folderId, có nghĩa là lấy root folder
      return next();
    }

    FolderModel.findOne({
      _id: folderId,
      status: 1,
      $or: [
        { ownerId: userId },
        { accessUsers: userId }
      ]
    })
    .populate('ownerId', 'name email username avatar')
    .populate('accessUsers', 'name email username avatar')
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
            body: 'Thư mục không tồn tại hoặc bạn không có quyền truy cập'
          },
        });
      }
      parentFolder = result;
      next();
    });
  };

  const getFolders = (next) => {
    const query = {
      status: 1,
      $or: [
        { ownerId: userId },
        { accessUsers: userId }
      ]
    };
    
    if (folderId) {
      query.parentId = folderId;
    } else {
      query.parentId = null; // Lấy các thư mục gốc
    }

    FolderModel.find(query)
      .select('_id name path parentId ownerId accessUsers createdAt updatedAt')
      .populate('ownerId', 'name email username avatar')
      .populate('accessUsers', 'name email username avatar')
      .sort({ name: 1 })
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        folders = result || [];
        next();
      });
  };

  const getFiles = (next) => {
    const query = {
      status: 1,
      $or: [
        { ownerId: userId },
        { accessUsers: userId }
      ]
    };
    
    if (folderId) {
      query.folderId = folderId;
    } else {
      query.folderId = null; // Lấy các file ở thư mục gốc
    }

    FileModel.find(query)
      .select('_id name originalName path folderId ownerId accessUsers size mimeType createdAt updatedAt')
      .populate('ownerId', 'name email username avatar')
      .populate('accessUsers', 'name email username avatar')
      .sort({ name: 1 })
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        files = result || [];
        next();
      });
  };

  const formatResponse = (next) => {
    next(null, {
      code: CONSTANTS.CODE.SUCCESS,
      data: {
        parentFolder: parentFolder ? {
          id: parentFolder._id,
          name: parentFolder.name,
          owner: parentFolder.ownerId,
          accessUsers: parentFolder.accessUsers || [],
          parentId: parentFolder.parentId
        } : null,
        folders: folders.map(folder => ({
          id: folder._id,
          name: folder.name,
          parentId: folder.parentId,
          owner: folder.ownerId,
          accessUsers: folder.accessUsers || [],
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
          type: 'folder'
        })),
        files: files.map(file => ({
          id: file._id,
          name: file.name,
          originalName: file.originalName,
          folderId: file.folderId,
          owner: file.ownerId,
          accessUsers: file.accessUsers || [],
          size: file.size,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
          type: 'file'
        })),
        totalFolders: folders.length,
        totalFiles: files.length
      }
    });
  };

  async.waterfall([
    checkParams, 
    getParentFolder, 
    getFolders, 
    getFiles, 
    formatResponse
  ], (err, data) => {
    if (_.isError(err)) {
      console.error('List children error:', err);
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
