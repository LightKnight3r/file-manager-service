const _ = require("lodash")
const async = require("async")
const ms = require("ms")
const config = require("config")
const util = require("util")
const rp = require("request-promise")

const redisConnection = require("../../../connections/redis")
const User = require("../../../models/user")
const SystemLog = require("../../../models/systemLog")
const CONSTANTS = require("../../../const")
const MESSAGES = require("../../../message")
const request = require('request')
const bcrypt = require('bcryptjs')

module.exports = (req, res) => {
 const code = req.body.code || ""
 const token = req.body.token || ""
 const username = req.body.username || ""
 const newPassword = req.body.newPassword || ""
 const rePassword = req.body.rePassword || ""
 let phone = req.body.phone || ""
 let email = req.body.email || ""
 let passwordEncrypt, userInf

 const checkParams = (next) => {
  if (!username || !code) {
   return next({
    code: CONSTANTS.CODE.WRONG_PARAMS,
    message: MESSAGES.SYSTEM.WRONG_PARAMS,
   })
  }

  if (!newPassword || (newPassword && !newPassword.trim())) {
   return next({
    code: CONSTANTS.CODE.WRONG_PARAMS,
    message: MESSAGES.USER.INVALID_NEW_PASSWORD,
   })
  }

  if (!rePassword || (rePassword && !rePassword.trim())) {
   return next({
    code: CONSTANTS.CODE.WRONG_PARAMS,
    message: MESSAGES.USER.INVALID_REPASSWORD,
   })
  }

  if (rePassword.trim() !== newPassword.trim()) {
   return next({
    code: CONSTANTS.CODE.WRONG_PARAMS,
    message: MESSAGES.USER.PASSWORD_NOT_SAME,
   })
  }
  // if(!phone.trim() && !email.trim()) {
  //  return next({
  //   code: CONSTANTS.CODE.WRONG_PARAMS,
  //   message: MESSAGES.USER.NOT_FOUND_PHONE_EMAIL,
  //  })
  // }

  next()
 }

 const findUser = (next) => {
  User.find({ username })
   .select("phone username email ")
   .lean()
   .exec((err, results) => {
    if (err) {
     return next(err)
    }
    if (!results.length) {
     return next({
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: {
       head: "Thông báo",
       body: "Tên đăng nhập chưa chính xác",
      },
     })
    }
    if (results.length > 1) {
     return next({
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.SYSTEM.ERROR,
     })
    }
    userInf = results[0]

    if (userInf.status == 0) {
     return next({
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.USER.INACTIVE,
     })
    }
    phone = userInf.phone
    email = userInf.email
    next()
   })
 }

 const checkCode = (next) => {
  const options = {
   method: "POST",
   uri: `${config.proxyRequestServer.codePhoneAddr}/api/v1.0/check-code`,
   body: {
    token,
    code,
    phone: phone,
    email
   },
   json: true, // Automatically stringifies the body to JSON
  }

  request(options, (err, response, result) => {
   if (err) {
    MailUtil.sendMail(` --- ERR ${config.proxyRequestServer.codePhoneAddr}/api/v1.0/check-code --- ${err}`)
   }

   if (err || !response || response.statusCode !== 200 || !result || result.code !== 200) {
    return next({
     code: CONSTANTS.CODE.WRONG_PARAMS,
     message: MESSAGES.USER.INVALID_OTP,
    })
   }

   next()
  })
 }

 const encryptPassword = (next) => {
  bcrypt.hash(newPassword.trim(), 10, function (err, hash) {
   if (err) {
    return next(err)
   }

   passwordEncrypt = hash
   next()
  })
 }

 const updatePassword = (next) => {
  User.update(
   {
    _id: userInf._id,
   },
   {
    password: passwordEncrypt,
    active: 1
   },
   (err, result) => {
    if (err) {
     return next(err)
    }
    next()
   },
  )
 }

 const writeLog = (next) => {
  next(null, {
   code: CONSTANTS.CODE.SUCCESS,
   message: MESSAGES.USER.CHANGE_PASSWORD_SUCCESS,
  })
  SystemLog
  .create({
    user: userInf._id,
    action: 'doi_mk',
    description: 'Đổi mật khẩu'
  },() =>{})
 }

 async.waterfall([checkParams, findUser, checkCode, encryptPassword, updatePassword, writeLog], (err, data) => {
  err &&
   _.isError(err) &&
   (data = {
    code: CONSTANTS.CODE.SYSTEM_ERROR,
    message: MESSAGES.SYSTEM.ERROR,
   })

  res.json(data || err)
 })
}
