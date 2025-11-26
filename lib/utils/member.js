const _ = require('lodash')
const async = require('async');
const MemberModel = require('../models/member')
const TransactionLogModel = require('../models/transactionLog')
const PointTransactionLogModel = require('../models/pointTransactionLog');
const PushNotifyManager = require('../jobs/pushNotify');

const config = require('config');
const rp = require('request-promise');
const MailUtil = require('./mail');
module.exports = {
  phoneIsNotStartWith: (listPhoneCheck, listStartPhone) => {
    let value = false;

    for (let i = 0; i < listPhoneCheck.length && !value; i++) {
      for (let j = 0; j < listStartPhone.length; j++) {
        if (listPhoneCheck[i].startsWith(listStartPhone[j])) {
          value = true;
          break;
        }
      }
    }

    return value;
  },
  handleIncreaseBonus: (obj, cb) => {
    const userId = obj.userId;
    const orderId = obj.orderId;
    const bonus = obj.bonus;
    const region = obj.region;

    if (!cb) {
      cb = (err) => {
        if (err) {
          logger.logError([err])
        }
      }
    }

    if (!bonus) {
      return cb();
    }

    let memberInfo;
    const increaseSSMFollowBonus = (done) => {
      MemberModel
        .findOneAndUpdate({
          _id: userId
        }, {
          $inc: {
            realMoney: bonus
          }
        })
        .exec((err, result) => {
          if (err || !result) {
            return done(err || new Error(`Not found user inf`));
          }

          memberInfo = result;

          done();
        })
    }

    const writeLogTransaction = (done) => {
      TransactionLogModel
        .create({
          member: userId,
          region: region,
          message: "Cộng tiền SSM hỗ trợ giao dịch",
          data: {
            amount: bonus,
            idOrder: orderId,
            type: 47,
            finalCoints: memberInfo.coints,
            initialCoints: memberInfo.coints,
            finalRealMoneyShop: memberInfo.realMoneyShop,
            initialRealMoneyShop: memberInfo.realMoneyShop,
            finalRealMoney: memberInfo.realMoney + bonus,
            initialRealMoney: memberInfo.realMoney
          }
        }, (err) => {
          done();
        })
    }

    async.waterfall([
      increaseSSMFollowBonus,
      writeLogTransaction
    ], cb)
  },
  handleBackDeposit: (obj, cb) => {
    const userId = obj.userId;
    const orderId = obj.orderId;
    const deposit = obj.deposit;
    const region = obj.region;
    const orderInf = obj.orderInf

    if (!cb) {
      cb = (err) => {
        if (err) {
          logger.logError([err])
        }
      }
    }

    if (!deposit) {
      return cb();
    }

    let memberInfo;
    const increaseDeposit = (done) => {
      MemberModel
        .findOneAndUpdate({
          _id: userId
        }, {
          $inc: {
            deposit: deposit
          }
        })
        .exec((err, result) => {
          if (err || !result) {
            return done(err || new Error(`Not found user inf`));
          }

          memberInfo = result;

          done();
        })
    }

    const writeLogTransaction = (done) => {
      TransactionLogModel
        .create({
          member: userId,
          region: region,
          message: "Trả lại phí thanh toán dịch vụ dọn dẹp",
          data: {
            amount: deposit,
            idOrder: orderId,
            type: 65,
            back: 1,
            finalCoints: memberInfo.coints,
            initialCoints: memberInfo.coints,
            finalRealMoneyShop: memberInfo.realMoneyShop,
            initialRealMoneyShop: memberInfo.realMoneyShop,
            finalRealMoney: memberInfo.realMoney,
            initialRealMoney: memberInfo.realMoney,
            initialDeposit: memberInfo.deposit,
            finalDeposit: memberInfo.deposit + deposit,
          }
        }, (err) => {
          done();
        })
    }

    const handlePayment = (done) => {
      if (orderInf.paymentMethod !== 'momo' && orderInf.paymentMethod !== 'zalo' && orderInf.paymentMethod !== 'shopee' && orderInf.paymentMethod !== 'tokenization') {
        return done();
      }

      if (orderInf.paymentMethod === 'momo') {
        if (orderInf.momoRef) {
          const options = {
            method: 'POST',
            uri: `${config.proxyRequestServer.payment}/api/v1.0/momo/payment/refund`,
            body: {
              id: orderInf.momoRef,
              amount: deposit
            },
            json: true
          };
          rp(options)
            .then((result) => {
              done()
            })
            .catch((err) => {
              MailUtil.sendMail(`Payment Server Error ${JSON.stringify(err)}`);
              done()
            });
        } else {
          return done();
        }
      }
      if (orderInf.paymentMethod === 'zalo') {
        if (orderInf.zaloRef) {
          const options = {
            method: 'POST',
            uri: `${config.proxyRequestServer.payment}/api/v1.0/zalo/payment/refund`,
            body: {
              id: orderInf.zaloRef,
              amount: deposit
            },
            json: true
          };
          rp(options)
            .then((result) => {
              done()
            })
            .catch((err) => {
              MailUtil.sendMail(`Payment Server Error ${JSON.stringify(err)}`);
              done()
            });
        } else {
          return done();
        }
      }

      if (orderInf.paymentMethod === 'shopee') {
        if (orderInf.shopeeRef) {
          const options = {
            method: 'POST',
            uri: `${config.proxyRequestServer.payment}/api/v1.0/shopee/payment/refund`,
            body: {
              id: orderInf.shopeeRef,
              amount: deposit
            },
            json: true
          };
          rp(options)
            .then((result) => {
              done()
            })
            .catch((err) => {
              MailUtil.sendMail(`Payment Server Error ${JSON.stringify(err)}`);
              done()
            });
        } else {
          return done();
        }
      }

      if (orderInf.paymentMethod === 'tokenization') {
        if (orderInf.tokenizationZaloRef) {
          const options = {
            method: 'POST',
            uri: `${config.proxyRequestServer.payment}/api/v1.0/zalo/tokenization/refund`,
            body: {
              id: orderInf.tokenizationZaloRef,
              amount: deposit
            },
            json: true
          };
          rp(options)
            .then((result) => {
              done()
            })
            .catch((err) => {
              MailUtil.sendMail(`Payment Server Error ${JSON.stringify(err)}`);
              done()
            });
        } else {
          return done();
        }
      }
    }

    async.waterfall([
      increaseDeposit,
      writeLogTransaction,
      handlePayment
    ], cb)
  },


  
  handleIncreaseRealMoneyViaInapp: (obj, cb) => {
    const userId = obj.userId;
    const orderId = obj.orderId;
    const amount = obj.amount;
    const region = obj.region;

    if (!cb) {
      cb = (err) => {
        if (err) {
          logger.logError([err])
        }
      }
    }

    if (!amount) {
      return cb();
    }

    let memberInfo;
    const increaseDeposit = (done) => {
      MemberModel
        .findOneAndUpdate({
          _id: userId
        }, {
          $inc: {
            realMoneyStaff: amount,
            realMoneyShopStaff: amount
          }
        })
        .exec((err, result) => {
          if (err || !result) {
            return done(err || new Error(`Not found user inf`));
          }

          memberInfo = result;

          done();
        })
    }

    const writeLogTransaction = (done) => {
      TransactionLogModel
        .create({
          member: userId,
          region: region,
          message: "Thanh toán phí dọn dẹp qua ứng dụng",
          data: {
            amount: amount,
            idOrder: orderId,
            type: 67,
            finalCoints: memberInfo.coints,
            initialCoints: memberInfo.coints,
            finalRealMoneyShop: memberInfo.realMoneyShop,
            initialRealMoneyShop: memberInfo.realMoneyShop,
            finalRealMoney: memberInfo.realMoney,
            initialRealMoney: memberInfo.realMoney,
            finalRealMoneyStaff: memberInfo.realMoneyStaff + amount,
            initialRealMoneyStaff: memberInfo.realMoneyStaff,
            finalRealMoneyShopStaff: memberInfo.realMoneyShopStaff + amount,
            initialRealMoneyShopStaff: memberInfo.realMoneyShopStaff,
          }
        }, (err) => {
          done();
        })
    }

    async.waterfall([
      increaseDeposit,
      writeLogTransaction
    ], cb)
  },

  handleIncreaseRealMoneySupport: (obj, cb) => {
    const userId = obj.userId;
    const amount = obj.amount;
    const region = obj.region;

    if (!cb) {
      cb = (err) => {
        if (err) {
          logger.logError([err])
        }
      }
    }

    if (!amount) {
      return cb();
    }

    let memberInfo;
    const increaseDeposit = (done) => {
      MemberModel
        .findOneAndUpdate({
          _id: userId
        }, {
          $inc: {
            realMoneyStaff: amount
          }
        })
        .exec((err, result) => {
          if (err || !result) {
            return done(err || new Error(`Not found user inf`));
          }

          memberInfo = result;

          done();
        })
    }

    const writeLogTransaction = (done) => {
      TransactionLogModel
        .create({
          member: userId,
          region: region,
          message: "Hoàn lại tiền cọc bộ dụng cụ dọn dẹp",
          data: {
            amount: amount,
            type: 66,
            finalCoints: memberInfo.coints,
            initialCoints: memberInfo.coints,
            finalRealMoneyShop: memberInfo.realMoneyShop,
            initialRealMoneyShop: memberInfo.realMoneyShop,
            finalRealMoney: memberInfo.realMoney,
            initialRealMoney: memberInfo.realMoney,
            finalRealMoneyStaff: memberInfo.realMoneyStaff + amount,
            initialRealMoneyStaff: memberInfo.realMoneyStaff,
            finalRealMoneyShopStaff: memberInfo.realMoneyShopStaff,
            initialRealMoneyShopStaff: memberInfo.realMoneyShopStaff,
          }
        }, (err) => {
          done();
        })
    }

    async.waterfall([
      increaseDeposit,
      writeLogTransaction
    ], cb)
  },

  handleIncreaseRealMoneyViaPoint: (obj, cb) => {
    const userId = obj.userId;
    const orderId = obj.orderId;
    const amount = obj.amount;
    const region = obj.region;

    if (!cb) {
      cb = (err) => {
        if (err) {
          logger.logError([err])
        }
      }
    }

    if (!amount) {
      return cb('Not found amount');
    }

    let memberInfo;
    const increaseRealMoney = (done) => {
      MemberModel
        .findOneAndUpdate({
          _id: userId
        }, {
          $inc: {
            realMoney: amount
          }
        })
        .exec((err, result) => {
          if (err || !result) {
            return done(err || new Error(`Not found user inf`));
          }

          memberInfo = result;

          done();
        })
    }

    const writeLogTransaction = (done) => {
      TransactionLogModel
        .create({
          member: userId,
          region: region,
          message: "Thanh toán qua điểm tích luỹ",
          data: {
            amount: amount,
            idOrder: orderId,
            type: 23,
            finalCoints: memberInfo.coints,
            initialCoints: memberInfo.coints,
            finalRealMoneyShop: memberInfo.realMoneyShop,
            initialRealMoneyShop: memberInfo.realMoneyShop,
            finalRealMoney: memberInfo.realMoney + amount,
            initialRealMoney: memberInfo.realMoney
          }
        }, (err, result) => {
          if (err) {
            logger.logError([err]);
          }

          done(err);
        })
    }

    async.waterfall([
      increaseRealMoney,
      writeLogTransaction
    ], cb)
  },
  handleIncreasePoint: (obj, cb) => {
    const userId = obj.userId;
    const orderId = obj.orderId;
    const region = obj.region;
    const point = obj.point;
    const orderInf = obj.orderInf;

    if (!cb) {
      cb = (err) => {
        if (err) {
          logger.logError([err])
        }
      }
    }

    if (!point || point < 0) {
      return cb();
    }

    let memberInfo;

    const increasePoint = (done) => {
      if (!point) {
        return done();
      }

      MemberModel
        .findOneAndUpdate({
          _id: userId
        }, {
          $inc: {
            point: point
          }
        })
        .exec((err, result) => {
          if (err || !result) {
            return done(err || new Error(`Not found user inf`));
          }

          memberInfo = result;

          PushNotifyManager.sendViaSocket(userId, 'point_update', { title: '', description: '', data: { link: '', extras: {} } }, ["customer"]);

          done();
        })
    }

    const writeLog = (done) => {
      if (!point) {
        return done();
      }

      PointTransactionLogModel
        .create({
          member: userId,
          order: orderId,
          region: region,
          message: "Cộng điểm giao dịch",
          data: {
            point: point,
            type: 9,
            finalPoint: memberInfo.point + point,
            initialPoint: memberInfo.point
          }
        }, (err) => {
          if (!err) {
            const messagePoint = `Bạn được cộng ${point} điểm cho đơn dọn dẹp. Cảm ơn bạn đã sử dụng dịch vụ của HeyU!`;
            PushNotifyManager
              .sendToMember(orderInf.customer, 'Heyyy', messagePoint, { link: '', extras: {} }, 'point_update')
          }

          done();
        })
    }

    async.waterfall([
      increasePoint,
      writeLog
    ], cb)
  }
}
