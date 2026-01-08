const express = require('express');
const router = express.Router();
const { DodoPayments } = require('dodopayments');
const Subscription = require('../models/subscriptionModel');
const SubscriptionPlan = require('../models/subscriptionPlanModel');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Initialize DODO Payments
const dodo = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: 'test_mode', // Forced to test_mode for debugging
});

console.log('Dodo SDK initialized in:', 'test_mode');

// Auth Middleware (copied from server.js logic)
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (jwtErr) {
        if (admin.apps.length > 0) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                // We need to find the user in our DB
                // Importing User model here might cause circular issues or we can just use mongoose.model
                const User = mongoose.model('User');
                const user = await User.findOne({ email: decodedToken.email });
                if (user) {
                    req.user = {
                        userId: user._id,
                        username: user.username,
                        role: user.role
                    };
                    return next();
                }
            } catch (firebaseErr) {
                // Both failed
            }
        }
    }

    return res.status(403).json({ message: 'Invalid or expired token' });
};

// Create Checkout Session
router.post('/create-checkout', authenticateToken, async (req, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user.userId;

        // Get plan details
        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        if (!plan.dodoProductId) {
            return res.status(400).json({ message: 'This plan is not configured for payments yet' });
        }

        // Get user details
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create DODO subscription
        // For recurring products, we must use subscriptions.create
        const subscription = await dodo.subscriptions.create({
            product_id: plan.dodoProductId,
            quantity: 1,
            customer: {
                email: user.email,
                name: user.username
            },
            billing: {
                country: 'US',
                city: 'New York',
                state: 'NY',
                street: '123 Main St',
                zipcode: '10001'
            },
            metadata: {
                userId: userId.toString(),
                planId: planId.toString()
            },
            payment_link: true, // Request a payment link
            return_url: `${req.headers.origin}/payment-success?planId=${planId}`,
        });

        console.log('DODO Subscription Created:', subscription);

        res.json({
            url: subscription.payment_link,
            checkoutId: subscription.subscription_id
        });
    } catch (error) {
        console.error('DODO Checkout Error:', error);
        res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
    }
});

// Webhook Handler
router.post('/webhook', async (req, res) => {
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET_KEY;

    try {
        // Verify webhook signature using DODO SDK
        // The SDK expects the raw body and headers
        const event = dodo.webhooks.unwrap(req.body.toString(), req.headers, webhookSecret);

        console.log('🔔 Received Verified DODO Webhook:', event.type);

        const User = mongoose.model('User');

        switch (event.type) {
            case 'subscription.active':
            case 'subscription.renewed':
                const subscriptionData = event.data;
                const userId = subscriptionData.metadata.userId;
                const planId = subscriptionData.metadata.planId;

                // Find or update subscription
                const plan = await SubscriptionPlan.findById(planId);

                // Calculate next billing
                const nextBilling = new Date(subscriptionData.next_billing_date);

                // Deactivate existing subscriptions
                await Subscription.updateMany(
                    { userId: new mongoose.Types.ObjectId(userId), status: 'active' },
                    { status: 'expired' }
                );

                const newSubscription = new Subscription({
                    userId: new mongoose.Types.ObjectId(userId),
                    planId: new mongoose.Types.ObjectId(planId),
                    status: 'active',
                    startDate: new Date(),
                    nextBilling: nextBilling,
                    amount: subscriptionData.total_amount / 100, // Assuming amount is in cents
                    transactionId: subscriptionData.subscription_id,
                    paymentMethod: 'dodo_payments'
                });

                await newSubscription.save();
                console.log(`✅ Subscription activated for user ${userId}`);
                break;

            case 'subscription.cancelled':
            case 'subscription.expired':
                const cancelledSub = event.data;
                await Subscription.updateMany(
                    { transactionId: cancelledSub.subscription_id },
                    { status: event.type === 'subscription.cancelled' ? 'cancelled' : 'expired' }
                );
                console.log(`❌ Subscription ${cancelledSub.subscription_id} ${event.type}`);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook Error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

module.exports = router;
