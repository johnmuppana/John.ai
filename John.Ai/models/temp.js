const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: String,
  content: String
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
