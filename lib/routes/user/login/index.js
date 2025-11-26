const fs = require('fs');
const data = {};

fs.readdirSync(__dirname).forEach((file) => {
  if(file !== 'index.js') {
    file = file.slice(0, -3);
    data[file] = require(`./${file}`)
  }
})

module.exports = data;
