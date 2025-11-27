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
    let query = {
      _id: { $ne: userId }
    }
    if(folderInf && folderInf.ownerId && userId !== folderInf.ownerId?.toString()) {
      accessUsers.push(folderInf.ownerId);
    }
    if(accessUsers.length > 0) {
      if(!query._id) {
        query._id = {
          $in: accessUsers
        };
      } else {
        query._id.$in = accessUsers;
      }
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
