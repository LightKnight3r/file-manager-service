const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const _ = require('lodash')
const mongoConnections = require('../connections/mongo')

const LocalSystemLog = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LocalUser'
    },
    action: {type: String},
    description: {
      type: String
    },
    data: {
      type: Schema.Types.Mixed
    },
    updatedData: {
      type: Schema.Types.Mixed
    },
    createdAt: {
      type: Number,
      default: Date.now
    }
}, {id: false, versionKey: false})


module.exports = mongoConnections('master').model('LocalSystemLog', LocalSystemLog);