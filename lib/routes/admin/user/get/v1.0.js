const _ = require("lodash")
const async = require("async")
const Joi = require("joi")
Joi.objectId = require("joi-objectid")(Joi)

const User = require("../../../../models/user")
const CONSTANTS = require("../../../../const")
const MESSAGES = require("../../../../message")

module.exports = (req, res) => {
 const { id } = req.body || ""
 const checkParams = (next) => {
  if (!id) {
   return next({
    code: CONSTANTS.CODE.WRONG_PARAMS,
    message: MESSAGES.SYSTEM.WRONG_PARAMS,
   })
  }
  next(null)
 }

 const getUserInf = (next) => {
  User.findOne({
    _id: id,
    status: 1
  }, "-password")
   .lean()
   .exec((err, result) => {
    if (err) {
     return next(err)
    }

    next(null, {
     code: CONSTANTS.CODE.SUCCESS,
     data: result,
    })
   })
 }

 async.waterfall([checkParams, getUserInf], (err, data) => {
  err &&
   _.isError(err) &&
   (data = {
    code: CONSTANTS.CODE.SYSTEM_ERROR,
    message: MESSAGES.SYSTEM.ERROR,
   })

  res.json(data || err)
 })
}
