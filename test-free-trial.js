const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const SubscriptionPlan = require('./models/subscriptionPlanModel');
const Subscription = require('./models/subscriptionModel');

// Test script to verify 14-day free trial functionality
const testFreeTrial = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wonderbot');
    console.log('📦 Connected to MongoDB');

    // Check if 14-day free trial plan exists
    console.log('\n🔍 Checking for Free Trail Plan...');
    const freeTrialPlan = await SubscriptionPlan.findOne({ 
      name: 'Free Trail Plan',
      isActive: true 
    });

    if (freeTrialPlan) {
      console.log('✅ Free Trail Plan found:');
      console.log(`   ID: ${freeTrialPlan._id}`);
      console.log(`   Name: ${freeTrialPlan.name}`);
      console.log(`   Duration: ${freeTrialPlan.duration} ${freeTrialPlan.durationType}`);
      console.log(`   Amount: $${freeTrialPlan.amount}`);
      console.log(`   Active: ${freeTrialPlan.isActive}`);
      console.log(`   Features: ${freeTrialPlan.features.length} features`);
    } else {
      console.log('❌ Free Trail Plan NOT found!');
      console.log('   Please run: npm run seed:plans');
      process.exit(1);
    }

    // Check recent subscriptions
    console.log('\n🔍 Checking recent subscriptions...');
    const recentSubscriptions = await Subscription.find()
      .populate('planId')
      .sort({ createdAt: -1 })
      .limit(5);

    if (recentSubscriptions.length > 0) {
      console.log(`\n📋 Found ${recentSubscriptions.length} recent subscription(s):`);
      recentSubscriptions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Subscription ID: ${sub._id}`);
        console.log(`   User ID: ${sub.userId}`);
        console.log(`   Plan: ${sub.planId?.name || 'Unknown'}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Amount: $${sub.amount}`);
        console.log(`   Start Date: ${sub.startDate.toLocaleDateString()}`);
        console.log(`   Next Billing: ${sub.nextBilling.toLocaleDateString()}`);
        console.log(`   Transaction: ${sub.transactionId}`);
      });
    } else {
      console.log('ℹ️  No subscriptions found yet.');
    }

    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
};

// Run the test
testFreeTrial();
