const mongoConnections = require("../connections/mongo")
const Schema = mongoose.Schema
const FileSchema = new mongoose.Schema(
 {
  name: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  folderId: { type: Schema.Types.ObjectId, ref: 'Folder', required: true },
  // path để dễ truy vấn, ví dụ: /root/ho-so-nhan-su/2025
  mimeType: String,
  size: Number,
  accessUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: { type: Number, default: 1 },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
 },
 { id: false, versionKey: false },
)

module.exports = mongoConnections("master").model("File", FileSchema)
