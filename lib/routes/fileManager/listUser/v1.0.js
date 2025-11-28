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
  const folderId = _.get(req, 'body.folderId', '');
  const edit = _.get(req, 'body.edit', 0);
  let accessUsers = [];
  let folderInf = null;
  const listAccessUsers = (next) => {
    if(!folderId) {
      return next();
    }
    FolderModel
      .findById(folderId, 'accessUsers ownerId')
      .lean()
      .exec((err, folder) => {
        if (err) {
          return next(err);
        }
        if (!folder) {
          return next({
            code: CONSTANTS.CODE.NOT_FOUND,
            message: {
              head: 'Thông báo',
              body: 'Thư mục không tồn tại'
            },
          });
        }
        folderInf = folder;
        accessUsers = folder.accessUsers || [];
        next();
      });
  };

  const listUsers = (next) => {
    if(!userId) {
      return next({
        code: CONSTANTS.CODE.WRONG_PARAMS,
        message: MESSAGES.SYSTEM.WRONG_PARAMS
      });
    }
    console.log('body:', req.body);

    let query = {
      _id: { $ne: userId }
    };

    if (edit === 1) {
      // Sửa thư mục hiện tại - chỉ show users đã có quyền truy cập
      if(folderInf.parentId) {
        // Nếu folderInf không có parentId (tức là thư mục con của root)
        if (folderInf && accessUsers.length > 0) {
        query._id = { $in: accessUsers };
        } else {
          // Nếu không có accessUsers thì trả về empty
          query._id = { $in: [] };
        }
      }
    } else {
      // Tạo thư mục mới (edit = 0) - show tất cả users có quyền trong parent folder
      // Loại bỏ userId hiện tại vì nó sẽ là owner của thư mục mới
      if (folderInf) {
        // Nếu có folderId (tạo trong thư mục con)
        let allowedUsers = [...accessUsers];
        
        // Thêm owner của folder cha vào danh sách được phép
        if (folderInf.ownerId && userId !== folderInf.ownerId.toString()) {
          allowedUsers.push(folderInf.ownerId);
        }
        
        // Loại bỏ userId hiện tại khỏi danh sách
        allowedUsers = allowedUsers.filter(id => id.toString() !== userId);
        
        if (allowedUsers.length > 0) {
          query._id = { $in: allowedUsers };
        } else {
          // Nếu không có user nào khác thì trả về empty
          query._id = { $in: [] };
        }
      }
      // Nếu không có folderId (tạo ở root) thì show tất cả users trừ user hiện tại (query đã có $ne: userId)
    }

    console.log('Query list users:', query);
    User
      .find(query, '_id name email avatar')
      .lean()
      .exec((err, users) => {
        if (err) {
          return next(err);
        }
        
        next(null, {
          code: CONSTANTS.CODE.SUCCESS,
          data: users,
        });
      });
  }

  async.waterfall([
    listAccessUsers,
    listUsers
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
