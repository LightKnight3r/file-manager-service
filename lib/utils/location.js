const config = require('config');
const request = require('./request');
const CONSTANTS = require('../const')

module.exports = {
  getNearest: (location, radius, service, cb) => {
    const url = `${config.proxyRequestServer.locationAddr}/api/v2.0/worker/get-nearest`;
    const body = {
      location,
      radius,
      service
    }

    request.post(url, body)
      .then((result) => {
        if (result.code !== CONSTANTS.CODE.SUCCESS) {
          return cb(new Error(`St wrong with api`))
        }

        cb(null, result.data)
      })
      .catch((err) => {
        MailUtil.sendMail(`Location Server Error ${JSON.stringify(err)}`);

        cb(err)
      })
  },
  filterWorker: (workers, region, cb) => {
    const url = `${config.proxyRequestServer.stateMachineAddr}/api/v1.0/machine/get-state`;
    const body = {
      ids: workers,
      region
    }

    request.post(url, body)
      .then((result) => {
        if (result.code !== CONSTANTS.CODE.SUCCESS) {
          return cb(new Error(`St wrong with api`))
        }

        cb(null, result.data)
      })
      .catch((err) => {
        MailUtil.sendMail(`StateMachine Server Error ${JSON.stringify(err)}`);
        cb(err)
      })
  },
  getRegionByLatLng: (location, level, cb) => {
    const url = `${config.proxyRequestServer.locationAddr}/api/v2.0/region/lat-lng`;
    const data = {
      location,
      level
    };

    request.post(url, data)
      .then((result) => {
        if (result.code !== 200) {
          return cb(result);
        }

        cb(null, result);
      })
      .catch((err) => {
        logger.logError(["getRegionByLatLng", err], __dirname);
        cb(err);
      })
  },
  getDistanceFromLatLonInKm: (lat1, lon1, lat2, lon2) => {
    var R = 6371.008; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return Math.round(d * 10) / 10
  },
  changeWardCode: (wardCode) => {
    if (wardCode === 'vietnam:haiphong:ngoquyen:luongkhanhthien') {
      console.log(`[WARNING] Adjusting wardCode from luongkhanhthien to caudat.`);
      wardCode = 'vietnam:haiphong:ngoquyen:caudat';
    } else if (wardCode === 'vietnam:haiphong:hongbang:quangtrung') {
      console.log(`[WARNING] Adjusting wardCode from quangtrung to hoangvanthu.`);
      wardCode = 'vietnam:haiphong:hongbang:hoangvanthu';
    } else if (wardCode === 'vietnam:haiphong:anduong:hongthi') {
      console.log(`[WARNING] Adjusting wardCode from hongthi to hongthai.`);
      wardCode = 'vietnam:haiphong:anduong:hongthai';
    } else if (wardCode === 'vietnam:haiphong:lechan:vinhkhiem') {
      console.log(`[WARNING] Adjusting wardCode from vinhkhiem to vinhniem.`);
      wardCode = 'vietnam:haiphong:lechan:vinhniem';
    } else if (wardCode === 'vietnam:haiphong:doson:vanson') {
      console.log(`[WARNING] Adjusting wardCode from vanson to haison.`);
      wardCode = 'vietnam:haiphong:doson:haison';
    } else if (wardCode === 'vietnam:haiphong:lechan:ngochai') {
      console.log(`[WARNING] Adjusting wardCode from ngochai to haison.`);
      wardCode = 'vietnam:haiphong:doson:haison';
    } else if (wardCode === 'vietnam:haiphong:anduong:vanxa') {
      console.log(`[WARNING] Adjusting wardCode from vanxa to quoctuan.`);
      wardCode = 'vietnam:haiphong:anduong:quoctuan';
    } else if (wardCode === 'vietnam:haiphong:duongkinh:xom2') {
      console.log(`[WARNING] Adjusting wardCode from xom2 to haithanh.`);
      wardCode = 'vietnam:haiphong:duongkinh:haithanh';
    } else if (wardCode === 'vietnam:haiphong:anlao:hoangxa') {
      console.log(`[WARNING] Adjusting wardCode from hoangxa to ttanlao.`);
      wardCode = 'vietnam:haiphong:anlao:ttanlao';
    } else if (wardCode === 'vietnam:haiphong:anduong:to4') {
      console.log(`[WARNING] Adjusting wardCode from to4 to ttanduong.`);
      wardCode = 'vietnam:haiphong:anduong:ttanduong';
    } else if (wardCode === 'vietnam:haiphong:tienlang:xomtrai') {
      console.log(`[WARNING] Adjusting wardCode from xomtrai to tttienlang.`);
      wardCode = 'vietnam:haiphong:tienlang:tttienlang';
    } else if (wardCode === 'vietnam:haiphong:anduong:anthai') {
      console.log(`[WARNING] Adjusting wardCode from anthai to andong.`);
      wardCode = 'vietnam:haiphong:anduong:andong';
    } else if (wardCode === 'vietnam:haiphong:kienan:phuluu') {
      console.log(`[WARNING] Adjusting wardCode from phuluu to trangminh.`);
      wardCode = 'vietnam:haiphong:kienan:trangminh';
    } else if (wardCode === 'vietnam:haiphong:anlao:anluan') {
      console.log(`[WARNING] Adjusting wardCode from anluan to ttanlao.`);
      wardCode = 'vietnam:haiphong:anlao:ttanlao';
    } else if (wardCode === 'vietnam:haiphong:duongkinh:vonghai') {
      console.log(`[WARNING] Adjusting wardCode from vonghai to hungdao.`);
      wardCode = 'vietnam:haiphong:duongkinh:hungdao';
      // } else if (wardCode === 'vietnam:haiphong:duongkinh:phuonglung') {
      //   console.log(`[WARNING] Adjusting wardCode from phuonglung to hungdao.`);
      //   wardCode = 'vietnam:haiphong:duongkinh:hungdao';
    }

    return wardCode;
  }
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}