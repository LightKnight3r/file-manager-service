const mongoConnections = require("../connections/mongo")
const Schema = mongoose.Schema
const PermissionSchema = new mongoose.Schema(
 {
  name: {
   type: String,
  },
  code: {
    type: String,
  },
  description: {
    type: String,
  },
  updatedAt: {
    type: Number,
    default: Date.now
  },
  createdAt: {
    type: Number,
    default: Date.now
  }
 },
 { id: false, versionKey: false },
)

module.exports = mongoConnections("master").model("Permission", PermissionSchema)
