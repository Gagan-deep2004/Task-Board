const mongoose = require('mongoose');

const ListSchema = new mongoose.Schema({
  title: { type: String, required: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  order: { type: Number, required: true }
}, { timestamps: true, optimisticConcurrency: true });

module.exports = mongoose.model('List', ListSchema);