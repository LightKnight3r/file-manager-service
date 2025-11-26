const mongoConnections = require("../connections/mongo")
const Schema = mongoose.Schema
const UserSchema = new mongoose.Schema(
 {
  username: {
   type: String,
   required: true
  },
  password: {
   type: String,
   required: true
  },
  email: {
    type: String,
    required: true,
  },
  name: {
   type: String,
   required: true
  },
  phone: {
   type: String
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin']
  },
  status: {
    type: Number,
    default: 1 // 1: active, 0: inactive
  },
  active:{
    type: Number,
    default: 1 // 1: has change password, 0: not change default password
  },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
  region: {
    type: String,
  },
  permissions: {
    type: [String],
    default: []
  }
 },
 { id: false, versionKey: false },
)

module.exports = mongoConnections("master").model("User", UserSchema)
