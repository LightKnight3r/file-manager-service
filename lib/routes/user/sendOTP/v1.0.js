const _ = require("lodash")
const async = require("async")
const moment = require("moment")
const config = require("config")
const util = require("util")
const rp = require("request-promise")
const CONSTANTS = require("../../../const")
const MESSAGES = require("../../../message")
const MailUtil = require("../../../utils/mail")
const tool = require('../../../utils/tool');
module.exports = (req, res) => {
 const username = req.body.username
 const platform = req.body.platform
 const otpMethod = req.body.otpMethod || 'sms'
 let phone = req.body.phone || ""
 let email = req.body.email || ""

 let userInf
 const checkUser = (next) => {
  UserModel.find({
   username,
   status: 1
  })
   .select("username phones status email")
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

    if (userInf.status == 0 || (otpMethod == 'sms' && (!userInf.phones || !userInf.phones.length)) || (otpMethod == 'email' && !userInf.email)) {
     return next({
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: MESSAGES.USER.INACTIVE,
     })
    }
    if(phone && !userInf.phones.includes(phone)) {
     return next({
      code: CONSTANTS.CODE.SYSTEM_ERROR,
      message: {
       head: "Thông báo",
       body: "Số điện thoại không hợp lệ",
      },
     })
    }
    if(!phone) {
      phone = userInf.phones[0]
    }

     if (email && email.toLowerCase() !== userInf.email.toLowerCase()) {
       return next({
         code: CONSTANTS.CODE.SYSTEM_ERROR,
         message: {
           head: "Thông báo",
           body: "Email không hợp lệ",
         },
       })
     }

     if (!email) {
       email = userInf.email
     }

    next()
   })
 }

 const sendCode = (next) => {
  const options = {
   method: "POST",
   uri: `${config.proxyRequestServer.codePhoneAddr}/api/v1.0/send-code`,
   body: {
    phone: phone,
    ip: req.headers["x-forwarded-for"],
    deviceId: req.body.deviceId,
    platform,
    otpMethod,
    email
   },
   json: true, // Automatically stringifies the body to JSON
  }

  if (platform === "web") {
   options.body.ip = req.body.ip
  }
  userInf.phone = tool.replaceIndex(phone, 3, 7, '*')
  delete userInf.phones

  rp(options)
   .then((result) => {
    next(null, {
      ...result,
      userInf
    })
   })
   .catch((err) => {
    MailUtil.sendMail(` --- ERR ${config.proxyRequestServer.codePhoneAddr}/api/v1.0/send-code --- ${err}`)

    next(err)
   })
 }

 async.waterfall([checkUser, sendCode], (err, data) => {
  if (_.isError(err)) {
   logger.logError([err], req.originalUrl, req.body)
  }

  err &&
   _.isError(err) &&
   (data = {
    code: CONSTANTS.CODE.SYSTEM_ERROR,
    message: MESSAGES.SYSTEM.ERROR,
   })

  res.json(data || err)
 })
}
