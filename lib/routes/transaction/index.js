const fs = require('fs');
const data = {};

fs.readdirSync(__dirname).forEach((file) => {
  if(file !== 'index.js') {
    file = file;
    data[file] = require(`./${file}`)
  }
})

module.exports = data;
