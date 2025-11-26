const fs = require('fs');
const path = require('path');

/**
 * Tạo file stream để đọc file từ đường dẫn
 * @param {string} filePath - Đường dẫn tới file cần stream
 * @returns {fs.ReadStream} - File stream
 */
const getFileStream = (filePath) => {
  // Kiểm tra file có tồn tại không
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Kiểm tra có phải là file không (không phải folder)
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  // Tạo và trả về read stream
  return fs.createReadStream(filePath);
};

/**
 * Kiểm tra quyền xem file của user
 * @param {Object} user - User object
 * @param {Object} file - File object từ database
 * @returns {boolean} - true nếu user có quyền xem file
 */
const canViewFile = (user, file) => {
  if (!user || !file) {
    return false;
  }

  const userId = user.id || user._id;
  
  // Owner của file có quyền xem
  if (file.ownerId && file.ownerId.toString() === userId.toString()) {
    return true;
  }

  // User trong danh sách accessUsers có quyền xem
  if (file.accessUsers && Array.isArray(file.accessUsers)) {
    return file.accessUsers.some(accessUserId => 
      accessUserId.toString() === userId.toString()
    );
  }

  return false;
};

/**
 * Lấy MIME type từ extension file
 * @param {string} filename - Tên file
 * @returns {string} - MIME type
 */
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
  };

  return mimeTypes[ext] || 'application/octet-stream';
};

module.exports = {
  getFileStream,
  canViewFile,
  getMimeType
};
