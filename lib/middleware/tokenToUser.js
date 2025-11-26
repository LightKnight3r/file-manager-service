const _ = require('lodash')
const redisConnections = require('../connections/redis')
const CONSTANTS = require('../const');
const MESSAGES = require('../message');

module.exports = (req, res, next) => {
    let token = _.get(req, 'headers.token', '');
    let appName;
    if (req.body.appName) {
        appName = req.body.appName
    }
    if (req.query.appName) {
        appName = req.query.appName
    }

    let stringToken = 'user'
    if (appName && appName !== 'cms') {
        stringToken = appName
    }
    if (!token) {
        return res.json({
            code: CONSTANTS.CODE.TOKEN_EXPIRE,
            message: MESSAGES.USER.TOKEN_EXPIRE
        });
    }

    redisConnections('master').getConnection().get(`${stringToken}:${token}`, (err, result) => {
        if (err) {
            return res.json({
                code: CONSTANTS.CODE.SYSTEM_ERROR,
                message: MESSAGES.SYSTEM.ERROR
            });
        }

        if (!result) {
            return res.json({
                code: CONSTANTS.CODE.TOKEN_EXPIRE,
                message: MESSAGES.USER.TOKEN_EXPIRE
            });
        }

        try {
            const objSign = JSON.parse(result);
            if (!_.has(objSign, 'id')) {
                return res.json({
                    code: CONSTANTS.CODE.TOKEN_EXPIRE,
                    message: MESSAGES.USER.TOKEN_EXPIRE
                });
            }

            req.user = objSign;
            next();
        } catch (e) {
            return res.json({
                code: CONSTANTS.CODE.TOKEN_EXPIRE,
                message: MESSAGES.USER.TOKEN_EXPIRE
            });
        }
    });
}
