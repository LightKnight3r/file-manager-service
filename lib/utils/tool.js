const CONSTANTS = require('../const');
// Chuyển số sang số La Mã
function toRoman(num) {
  const map = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  for (const [value, symbol] of map) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

// Chuyển số sang chữ cái: 1 -> a, 2 -> b,...
function toLetter(index) {
  return String.fromCharCode(96 + index); // 'a' là 97
}

// Đếm các cấp
let romanIndex = 1;
let numberIndex = 1;
let letterIndex = 1;

// Hàm định dạng
function formatMarkdown(mdContent) {
  romanIndex = 1;
  numberIndex = 1;
  letterIndex = 1;

  return (
    mdContent
      .replace(/#### /g, '')
      .replace(/### /g, '')
      .replace(/## /g, '')
      .replace(/# /g, '')

      // Gạch đầu dòng
      .replace(/^- (.*)$/gm, '• $1')
      .replace(/^\* (.*)$/gm, '• $1')

      // Loại bỏ định dạng đậm/nghiêng
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')

      // Bỏ bảng markdown
      // .replace(/^\|.*\|$/gm, '')
      // .replace(/^\s*\n/gm, '')

      // Giãn cách đoạn văn
      .replace(/\n{2,}/g, '\n\n')
  );
}

module.exports = {
  change_alias: function (alias) {
    var str = alias;
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/[^a-zA-Z0-9]/g, '');
    /* tìm và thay thế các kí tự đặc biệt trong chuỗi sang kí tự - */
    // str= str.replace(/-+-/g,"-"); //thay thế 2- thành 1-
    // str= str.replace(/^\-+|\-+$/g,"");
    //cắt bỏ ký tự - ở đầu và cuối chuỗi
    return str;
  },
  checkJobStatus: (stt) => {
    switch (stt) {
      case CONSTANTS.JOB_STATUS.WAIT_FOR_CONFIRM:
        return 'Chờ xác nhận';
        break;
      case CONSTANTS.JOB_STATUS.PENDING:
        return 'Chờ';
        break;
      case CONSTANTS.JOB_STATUS.WAIT_FOR_PAYMENT:
        return 'Chờ thanh toán';
        break;
      case CONSTANTS.JOB_STATUS.FINDING:
        return 'Tìm kiếm';
        break;
      case CONSTANTS.JOB_STATUS.FOUND_STAFF:
        return 'Đã nhận';
        break;
      case CONSTANTS.JOB_STATUS.MOVING:
        return 'Di chuyển';
        break;
      case CONSTANTS.JOB_STATUS.EXECUTING:
        return 'Đang dọn dẹp';
        break;
      case CONSTANTS.JOB_STATUS.DONE:
        return 'Hoàn thành';
        break;
      case CONSTANTS.JOB_STATUS.REJECTED:
        return 'Hủy';
        break;
      case CONSTANTS.JOB_STATUS.CAN_NOT_FIND_STAFF:
        return 'Ế';
        break;
      default:
        return stt;
    }
  },
  checkStatus: (stt) => {
    switch (stt) {
      case CONSTANTS.STATUS.UNREGISTERED:
        return 'Chưa đăng ký';
        break;
      case CONSTANTS.STATUS.REGISTERED:
        return 'Đã đăng ký';
        break;
      case CONSTANTS.STATUS.ORDERED:
        return 'Đã lên đơn';
        break;
      case CONSTANTS.STATUS.ORDER_SUCCESS:
        return 'Lên đơn thành công';
        break;
      default:
        return stt;
    }
  },
  checkStatusSale: (stt) => {
    switch (stt) {
      case CONSTANTS.STATUS_SALE.ORIGINAL:
        return 'Chưa sale';
        break;
      case CONSTANTS.STATUS_SALE.REJECTED:
        return 'Từ chối';
        break;
      case CONSTANTS.STATUS_SALE.ACCEPTED:
        return 'Đồng ý';
        break;
      default:
        return stt;
    }
  },
  generatePassword: (length = 8) => {
    let charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      retVal = '';
    for (var i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  },
  replaceIndex: (str, startIndex, endIndex, strReplace) => {
    return str
      .split('')
      .map((char, i) => (startIndex <= i && i <= endIndex ? strReplace : char))
      .join('');
  },
  convertScreenToLink: (screen) => {
    if (!screen) {
      return screen;
    }
    return screen
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .split('-')
      .slice(1)
      .join('-');
  },
  isValidURL: (str) => {
    try {
      new URL(str);
      return true;
    } catch (_) {
      return false;
    }
  },
  checkStringByCondition(str, cond) {
    if (!cond) {
      let checkStr = str ? str.includes('Không có thông tin') : true;
      if (checkStr) {
        return { isValid: false, explain: 'Không có thông tin' };
      } else {
        return { isValid: true, explain: 'Có thông tin' };
      }
    }
    if (!str || !cond) {
      return { isValid: null, explain: 'Điều kiện không xác định' };
    }
    const strLowerCase = str.toLowerCase();
    const condition = cond.toLowerCase();
    const orSegments = condition.split('|').map((segment) => segment.trim());

    for (const segment of orSegments) {
      const andSegments = segment.split('&').map((term) => term.trim());
      const allTermsMatch = andSegments.every((term) => strLowerCase.includes(term));
      if (allTermsMatch) {
        return { isValid: true, explain: `Khớp với: ${cond}` };
      }
    }
    return { isValid: false, explain: `Không có điều kiện nào khớp: ${cond}` };
  },

  msToMinutes: (ms) => {
    return Math.floor(ms / 60000);
  },
  formatMarkdown,
  camelCaseToRouterCase: (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  },
  camelCaseToLodashCase: (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  },
};
