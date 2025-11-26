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
  passwordLevel2: {
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
  status: {
    type: Number,
    default: 1 // 1: active, 0: inactive
  },
  active:{
    type: Number,
    default: 0 // 1: has change password, 0: not change default password
  },
  activeLevel2:{
    type: Number,
    default: 0 // 1: has change password level 2, 0: not change default password level 2
  },
  lastTimeChangePass: {
    type: Number,
  },
  lastTimeChangePassLevel2: {
    type: Number,
  },
  countWrongPassLevel2: {
    type: Number,
    default: 0
  },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
  permissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission'
  }]
 },
 { id: false, versionKey: false },
)

module.exports = mongoConnections("master").model("User", UserSchema)
