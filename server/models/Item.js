const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['lost', 'found'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    dateLost: {
      type: Date
    },
    dateFound: {
      type: Date
    },
    image: {
      type: String,
      default: ''
    },
    reward: {
      type: String,
      trim: true,
      maxlength: 80,
      default: ''
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open'
    }
  },
  {
    timestamps: true
  }
);

itemSchema.index({ title: 'text', description: 'text', location: 'text', category: 'text' });

module.exports = mongoose.model('Item', itemSchema);
