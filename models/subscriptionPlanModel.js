const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true, // in days
    min: 1
  },
  durationType: {
    type: String,
    enum: ['days', 'months', 'years'],
    default: 'months'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  originalAmount: {
    type: Number, // For showing discounts
    default: null
  },
  discount: {
    type: Number,
    default: 0, // Percentage
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  features: [{
    type: String
  }],
  description: {
    type: String,
    trim: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  dodoProductId: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
