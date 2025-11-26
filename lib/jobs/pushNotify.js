const config = require('config');
const rp = require('request-promise');
const CONSTANTS = require('../const');
const MailUtil = require('../utils/mail');

class NotifyManager {
  sendToMember(id, title, description, data, eventName, appName) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        uri: `${config.proxyRequestServer.pushNotify}/api/v1.0/push-notification/member`,
        body: {
          userId: id,
          title: title,
          message: description,
          data: data,
          eventName: eventName,
          appName: appName ? appName : 'customer',
        },
        json: true, // Automatically stringifies the body to JSON
      };

      rp(options)
        .then((result) => {
          if (result.code === 501) {
            return reject(result);
          }

          if (result.code === CONSTANTS.CODE.FAIL || result.code === CONSTANTS.CODE.SYSTEM_ERROR) {
            return reject(result);
          }

          resolve(result);
        })
        .catch((err) => {
          MailUtil.sendMail(`PushNotify Server Error ${JSON.stringify(err)}`);
          reject(err);
        });
    });
  }

  sendAll(query, title, description, data) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        uri: `${config.proxyRequestServer.pushNotify}/api/v1.0/push-notification/all`,
        body: {
          query: query,
          title: title,
          message: description,
          data: data,
        },
        json: true, // Automatically stringifies the body to JSON
      };
      rp(options)
        .then((result) => {
          if (result.code === 500) {
            return reject(new Error(`System error`));
          }

          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  sendViaSocket(id, eventName, data, platforms) {
    const options = {
      method: 'POST',
      uri: `${config.proxyRequestServer.socketRealtime}/api/v1.0/emit/member`,
      body: {
        eventName: eventName,
        data: data,
        userId: id,
        platforms,
      },
      json: true, // Automatically stringifies the body to JSON
    };

    rp(options)
      .then((result) => {})
      .catch((err) => {
        MailUtil.sendMail(`SocketRealtime Server Error ${JSON.stringify(err)}`);
      });
  }
}

module.exports = new NotifyManager();
