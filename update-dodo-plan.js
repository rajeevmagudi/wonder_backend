const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const SubscriptionPlan = require('./models/subscriptionPlanModel');

const DODO_MONTHLY_PRODUCT_KEY = 'pdt_0NVLBc0urcBozWo8x7lF8';

const updatePlan = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wonderbot');
        console.log('Connected to MongoDB');

        const result = await SubscriptionPlan.updateOne(
            { name: 'Monthly Plan' },
            { $set: { dodoProductId: DODO_MONTHLY_PRODUCT_KEY } }
        );

        if (result.matchedCount > 0) {
            console.log('✅ Monthly Plan updated with DODO Product ID');
        } else {
            console.log('⚠️ Monthly Plan not found in database');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error updating plan:', error);
        process.exit(1);
    }
};

updatePlan();
