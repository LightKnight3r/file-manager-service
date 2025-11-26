const _ = require('lodash')
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const secretKey = config.secretKey;

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    next();
  });
}
