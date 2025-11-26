const nodemailer = require('nodemailer');
const _ = require('lodash');
const config = require('config');
const rr = require('rr');

transporters = config.emailInfos.map((emailObj) => {
  return nodemailer.createTransport(emailObj)
})

let listRecents = [];

setInterval(() => {
  listRecents = [];
}, 2 * 60 * 1000);

module.exports = {
  sendMail: (body, targetEmail) => {

    if (listRecents.indexOf(body) !== -1) {
      return;
    }

    listRecents.push(body);
    if (!targetEmail) {
      listEmailAlert = _.get(config, 'listEmailAlert', []).join(',');
    }

    const mailOptions = {
      from: '"HeyU" <no-reply@heyu.vn>', // sender address
      to: listEmailAlert, // list of receivers
      subject: `HeyU - ${config.serviceName} - ${config.environment}`, // Subject line
      text: body
    }
    const transporter = rr(transporters) || '';
    if (!transporter) {
      logger.logError(["Not found mail config emailInfos"]);
    } else {
      transporter.sendMail(mailOptions, (error, info) => {
        logger.logInfo("Send mail:", error, info);
      });
    }
  },
  sendEMail: (body, targetEmail) => {
    if (!targetEmail) {
      return
    }
    const mailOptions = {
      from: '"HeyU" <no-reply@heyu.vn>', // sender address
      to: targetEmail, // list of receivers
      subject: body.subject, // Subject line
      text: body.text,
      html: body.html,
    }
    const transporter = rr(transporters) || '';
    if (!transporter) {
      logger.logError(["Not found mail config emailInfos"]);
    } else {
      transporter.sendMail(mailOptions, (error, info) => {
        logger.logInfo("Send mail:", error, info);
      });
    }
  }
}