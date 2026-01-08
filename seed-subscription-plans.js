const mongoose = require('mongoose');
require('dotenv').config();

// Subscription Plan Schema
const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true,
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
    type: Number,
    default: null
  },
  discount: {
    type: Number,
    default: 0,
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
  }
}, {
  timestamps: true
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

// Default subscription plans
const defaultPlans = [
  {
    name: 'Monthly Plan',
    duration: 1,
    durationType: 'months',
    amount: 9.99,
    originalAmount: null,
    discount: 0,
    isActive: true,
    features: [
      'Access to all activities',
      'Educational videos',
      'Interactive e-books',
      'Art and creativity tools',
      'Music activities',
      'Fun educational games'
    ],
    description: 'Perfect for trying out all features',
    isPopular: false,
    dodoProductId: 'pdt_0NVLBc0urcBozWo8x7lF8' // Monthly plan ID
  },
  {
    name: 'Quarterly Plan',
    duration: 3,
    durationType: 'months',
    amount: 24.99,
    originalAmount: 29.97,
    discount: 17,
    isActive: true,
    features: [
      'Access to all activities',
      'Educational videos',
      'Interactive e-books',
      'Art and creativity tools',
      'Music activities',
      'Fun educational games',
      'Priority support'
    ],
    description: 'Save 17% with quarterly billing',
    isPopular: true,
    dodoProductId: '' // TODO: Add Quarterly Plan ID
  },
  {
    name: 'Annual Plan',
    duration: 1,
    durationType: 'years',
    amount: 79.99,
    originalAmount: 119.88,
    discount: 33,
    isActive: true,
    features: [
      'Access to all activities',
      'Educational videos',
      'Interactive e-books',
      'Art and creativity tools',
      'Music activities',
      'Fun educational games',
      'Priority support',
      'Exclusive content',
      'Early access to new features'
    ],
    description: 'Best value! Save 33% annually',
    isPopular: false,
    dodoProductId: '' // TODO: Add Annual Plan ID
  },
  {
    name: 'Free Trail Plan',
    duration: 14,
    durationType: 'days',
    amount: 0,
    originalAmount: null,
    discount: 0,
    isActive: true,
    features: [
      'Access to all activities',
      'Educational videos',
      'Interactive e-books',
      'Art and creativity tools',
      'Music activities',
      'Fun educational games'
    ],
    description: 'Free 14-day trial for new users',
    isPopular: false
  },
  {
    name: '7-Day Trial',
    duration: 7,
    durationType: 'days',
    amount: 0.99,
    originalAmount: null,
    discount: 0,
    isActive: true,
    features: [
      'Access to all activities',
      'Educational videos',
      'Interactive e-books',
      'Art and creativity tools',
      'Music activities',
      'Fun educational games'
    ],
    description: 'Try all features for 7 days',
    isPopular: false
  }
];

// Seed subscription plans
const seedSubscriptionPlans = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wonderbot');
    console.log('📦 Connected to MongoDB');

    // Clear existing plans (optional - comment out if you want to keep existing ones)
    await SubscriptionPlan.deleteMany({});
    console.log('🗑️  Cleared existing subscription plans');

    // Check if plans already exist
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans > 0) {
      console.log(`ℹ️  Found ${existingPlans} existing subscription plans. Skipping seed.`);
      console.log('   Delete plans manually or uncomment deleteMany in script to re-seed.');
      process.exit(0);
    }

    // Insert default plans
    const result = await SubscriptionPlan.insertMany(defaultPlans);
    console.log(`✅ Successfully seeded ${result.length} subscription plans`);

    // Display created plans
    console.log('\n📋 Created Subscription Plans:');
    result.forEach((plan, index) => {
      console.log(`\n${index + 1}. ${plan.name}`);
      console.log(`   Duration: ${plan.duration} ${plan.durationType}`);
      console.log(`   Amount: $${plan.amount}`);
      if (plan.originalAmount) {
        console.log(`   Original: $${plan.originalAmount} (${plan.discount}% off)`);
      }
      console.log(`   Popular: ${plan.isPopular ? 'Yes' : 'No'}`);
      console.log(`   Features: ${plan.features.length} features`);
    });

    console.log('\n🎉 Subscription plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding subscription plans:', error);
    process.exit(1);
  }
};

// Run the seed function
seedSubscriptionPlans();
