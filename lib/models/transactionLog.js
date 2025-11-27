const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const _ = require('lodash')
const mongoConnections = require('../connections/mongo')

const TransactionLog = new mongoose.Schema({
  member: {
    type: Schema.Types.ObjectId,
    ref: 'Member'
  },
  data: {
    type: Schema.Types.Mixed
  },
  message: {
    type: String
  },
  region: {
    type: String
  },
  isRefund: {
    type: Number
  },
  createdAt: {
    type: Number,
    default: Date.now
  }
}, {id: false, versionKey: false, read: 'secondary'});

module.exports = mongoConnections('slaver').model('TransactionLog', TransactionLog);
