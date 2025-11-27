const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const _ = require('lodash')
const mongoConnections = require('../connections/mongo')

var OrderSystem = new mongoose.Schema({
  type: {
    type: Schema.Types.ObjectId,
    ref: 'Service'
  },
  cardType: {
    type: Schema.Types.ObjectId,
    ref: 'CardDistribute'
  },
  card: {
    type: Schema.Types.ObjectId
  },
  shipper: {
    type: Schema.Types.ObjectId,
    ref: 'Member'
  },
  shop: {
    type: Schema.Types.ObjectId,
    ref: 'Member'
  },
  current_place: { type: mongoose.Schema.Types.Mixed },
  origin_place: { type: mongoose.Schema.Types.Mixed },
  destination_places: { type: mongoose.Schema.Types.Mixed },
  deposit: {
    type: Number,
    default: 0
  },
  salary: {
    type: Number,
    default: 0
  },
  promote: {
    type: Schema.Types.ObjectId,
    ref: 'PromoteCode'
  },
  distance: {
    type: Number,
    default: 0
  },
  unrank: {
    type: Number
  },
  note: {
    type: String,
    default: ""
  },
  phone: {
    type: String,
    default: ""
  },
  status: {
    type: Number,
    default: 0
  },
  pending: {
    type: Number,
    default: 0
  },
  hideShipper: {
    type: Number,
    default: 0
  },
  ensure: {
    type: Number,
    default: 0
  },
  rejects: {
    type: [String],
    default: []
  },
  orderType: {
    type: Schema.Types.ObjectId,
    ref: 'OrderType'
  },
  tip: {
    type: Number,
    default: 0
  },
  resourceFee: {
    type: Number
  },
  bonus: {
    type: Number,
    default: 0
  },
  takeOrderInf: {
    type: Schema.Types.Mixed
  },
  doneOrderInf: {
    type: Schema.Types.Mixed
  },
  serviceCharge:{
    type: Number
  },
  createdAt: {
    type: Number,
    default: Date.now
  },
  acceptedAt: {
    type: Number,
    default: Date.now
  },
  updatedAt: {
    type: Number,
    default: Date.now
  },
  hasCalled: {
    type: Number,
    default: 0
  },
  shopHasCalled: {
    type: Number,
    default: 0
  },
  hasMessage: {
    type: Number,
    default: 0
  },
  shopHasMessage: {
    type: Number,
    default: 0
  },
  hasNotifyTake: {
    type: Number,
    default: 0
  },
  handleBonus: {
    hasHandle: {
      type: Number
    },
    valid: {
      type: Number
    },
    message: {
      type: String
    }
  },
  hasNotifyDone: {
    type: Number,
    default: 0
  },
  cointL1: {
    type: Number
  }
}, {versionKey: false, read:'secondary'})



module.exports = mongoConnections('slaver').model('OrderSystem', OrderSystem);
