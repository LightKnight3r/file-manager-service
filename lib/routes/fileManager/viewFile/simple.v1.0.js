const _ = require('lodash');
const { getFileStream, canViewFile } = require('../../../utils/fileUtils');
const FileModel = require('../../../models/file');

module.exports = async (req, res) => {
  try {
    const file = await FileModel.findById(req.params.id);
    
    if (!file) {
      return res.status(404).send('Not found');
    }
    
    if (!canViewFile(req.user, file)) {
      return res.status(404).send('Forbidden');
    }

    // Tạo đường dẫn file từ URL trong database
    const filePath = `./public${file.url}`;
    const stream = getFileStream(filePath);

    // Chỉ cho "inline" – không attachment
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="' + encodeURIComponent(file.name) + '"'
    );

    // Handle stream errors
    stream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).send('Error streaming file');
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('View file error:', error);
    if (error.message.includes('File not found')) {
      return res.status(404).send('File not found');
    }
    res.status(500).send('Internal server error');
  }
};
