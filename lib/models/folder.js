const mongoConnections = require("../connections/mongo")
const Schema = mongoose.Schema
const FolderSchema = new mongoose.Schema(
 {
  name: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'LocalUser', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'LocalFolder', default: null },
  // path để dễ truy vấn, ví dụ: /root/ho-so-nhan-su/2025
  path: { type: String },
  // quyền trực tiếp gán cho folder này
  accessUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'LocalUser'
  }],
  status: { type: Number, default: 1 },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
 },
 { id: false, versionKey: false },
)

module.exports = mongoConnections("master").model("LocalFolder", FolderSchema)
