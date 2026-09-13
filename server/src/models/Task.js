const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
  order: { type: Number, required: true },
  attachmentUrl: { type: String }, // Cloudinary secure_url, set via the attachment upload endpoint
  sharedWith: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['Viewer', 'Editor'], default: 'Viewer' }
  }]
}, { timestamps: true, optimisticConcurrency: true });

module.exports = mongoose.model('Task', TaskSchema);