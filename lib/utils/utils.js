const _ = require('lodash');

module.exports = {
  replacePhone: (text) => {
    return removePhone(text);
  },
  handleReplaceAddress: (input) => {
    let replaceValue = input;

    replaceValue = replaceValue.replace(', Hà Nội, Vietnam', '');
    replaceValue = replaceValue.replace(', Hà Nội, Việt Nam', '');
    replaceValue = replaceValue.replace(', Hải Phòng, Vietnam', '');
    replaceValue = replaceValue.replace(', Hải Phòng, Việt Nam', '');
    replaceValue = replaceValue.replace(', Nghệ An, Vietnam', '');
    replaceValue = replaceValue.replace(', Nghệ An, Việt Nam', '');
    replaceValue = replaceValue.replace(', Thanh Hoá, Vietnam', '');
    replaceValue = replaceValue.replace(', Thanh Hoá, Việt Nam', '');
    replaceValue = replaceValue.replace(', Cần Thơ, Vietnam', '');
    replaceValue = replaceValue.replace(', Cần Thơ, Việt Nam', '');
    replaceValue = replaceValue.replace(', Đà Nẵng, Vietnam', '');
    replaceValue = replaceValue.replace(', Đà Nẵng, Việt Nam', '');

    replaceValue = replaceValue.replace(', Việt Nam', '');
    replaceValue = replaceValue.replace(', Vietnam', '');

    return replaceValue;
  },
  convertDescription: (description) => {
    switch (description) {
      case 'ATTITUDE':
        return {
          icon: 'https://media.heyu.asia/uploads/new-image-service/2021-07-30-thaido.png',
          message: 'Thái độ',
        };
        break;
      case 'EXCELLENT':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-chuyennghiep.png',
          message: 'Chuyên nghiệp',
        };
        break;
      case 'LATE':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-30-delay-2.png',
          message: 'Đến muộn',
        };
        break;
      case 'GOOD':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-03-06-friendly.png',
          message: 'Thiện chí',
        };
        break;
      case 'CARELESS':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-03-06-friendly.png',
          message: 'Cẩu thả',
        };
        break;
      case 'FAST':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-nhanhchong.png',
          message: 'Nhanh chóng',
        };
        break;
      case 'BEHAVIOR':
        return {
          icon: 'https://media.heyu.asia/uploads/new-image-service/2021-07-30-giaotiep.png',
          message: 'Giao tiếp',
        };
        break;
      case 'FRIENDLY':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-thanthien.png',
          message: 'Thân thiện',
        };
        break;
      case 'SAFE':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-canthan.png',
          message: 'Cẩn thận',
        };
        break;
      case 'POLITE':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-lichsu.png',
          message: 'Lịch sự',
        };
        break;
      case 'ENTHUSIASM':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-nhiettinh.png',
          message: 'Nhiệt tình',
        };
        break;
      case 'GET_MORE_MONEY':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-30-cheat.png',
          message: 'Gian lận',
        };
        break;
      case 'INCORRECT_STAFF':
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-30-wrong.png',
          message: 'Không đúng nhân viên',
        };
        break;
      default:
        return {
          icon: 'https://media.heyu.asia/uploads/rating/2021-07-28-nhiettinh.png',
          message: '',
        };
        break;
    }
  },
};

function removePhone(str) {
  const arrStartedPhoneNumber = ['09', '01', '08', '02', '84', '05', '03', '07'];

  let phonesFromStr = [];
  let done = false;

  while (!done) {
    let phoneTemp;
    for (var i = 0; i < arrStartedPhoneNumber.length; i++) {
      var phone = getPhoneNumberSub(str, arrStartedPhoneNumber[i]);
      if (phone != '-1' && phone != '-2' && phone.length >= 10 && phonesFromStr.indexOf(phone) === -1) {
        phonesFromStr.push(phone);
        phoneTemp = phone;
        break;
      }
    }

    if (phoneTemp) {
      str = str.replace(/\+84/g, '0');
      str = str.replace(/0 /g, '0');
      var i = -1;
      var doneReplace = false;
      while (!doneReplace && (i = str.indexOf('0', i + 1)) >= 0) {
        var temp = str.substring(i);
        temp = temp.replace(/[^a-zA-Z0-9]/g, '');
        if (temp.startsWith(phoneTemp)) {
          // Found phone number
          str = str.substring(0, i + phoneTemp.length - 3) + '***' + str.substring(i + phoneTemp.length);
          doneReplace = true;
        }
      }
    } else {
      done = true;
    }
  }

  return str;
}

function getPhoneNumberSub(str, startedpn) {
  str = str.replace(/\+84/g, '0');
  str = str.replace(/[^a-zA-Z0-9]/g, '');
  let phone = '-1';
  //alert(str);
  if (str.length < 10) return '-2';
  if (str.indexOf(startedpn) >= 0) {
    let idx = str.indexOf(startedpn);
    try {
      phone = str.substring(idx, idx + 11);
      if (isNaN(phone)) {
        // Khong phai la so
        phone = str.substring(idx, idx + 10);
        iPhoneNumber = parseInt(phone);
        if (isNaN(phone)) {
          return getPhoneNumberSub(str.substring(idx + 2), startedpn);
        }
      }
    } catch (e) {
      return getPhoneNumberSub(str.substring(idx + 2), startedpn);
    }
  }
  return phone;
}
