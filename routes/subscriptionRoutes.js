const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Subscription = require('../models/subscriptionModel');
const SubscriptionPlan = require('../models/subscriptionPlanModel');

// Get user's current subscription
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({ userId })
      .populate('planId')
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({ subscription: null });
    }

    // Check if subscription has expired
    const currentDate = new Date();
    const nextBillingDate = new Date(subscription.nextBilling);

    if (currentDate > nextBillingDate && subscription.status === 'active') {
      subscription.status = 'expired';
      await subscription.save();
    }

    res.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Error fetching subscription' });
  }
});

// Get subscription status (alias for /current)
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({ userId })
      .populate('planId')
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({ subscription: null });
    }

    // Check if subscription has expired
    const currentDate = new Date();
    const nextBillingDate = new Date(subscription.nextBilling);

    if (currentDate > nextBillingDate && subscription.status === 'active') {
      subscription.status = 'expired';
      await subscription.save();
    }

    res.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Error fetching subscription' });
  }
});

// Subscribe to a plan
router.post('/subscribe', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;

    // Get the plan details
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    if (!plan.isActive) {
      return res.status(400).json({ message: 'This plan is not available' });
    }

    // Block calling this endpoint for paid plans (must use payment checkout)
    if (plan.amount > 0) {
      return res.status(400).json({ message: 'Payment required for this plan. Please initiate checkout.' });
    }

    // Calculate next billing date
    const startDate = new Date();
    const nextBilling = new Date(startDate);

    // Calculate duration in days based on durationType
    let durationInDays = plan.duration;
    if (plan.durationType === 'months') {
      durationInDays = plan.duration * 30; // Approximate
    } else if (plan.durationType === 'years') {
      durationInDays = plan.duration * 365; // Approximate
    }

    nextBilling.setDate(nextBilling.getDate() + durationInDays);

    // Cancel any existing active subscriptions
    await Subscription.updateMany(
      { userId, status: 'active' },
      { status: 'cancelled' }
    );

    // Create new subscription
    const subscription = new Subscription({
      userId,
      planId: plan._id,
      status: 'active',
      startDate,
      nextBilling,
      amount: plan.amount,
      transactionId: `TXN-${Date.now()}-${userId}`
    });

    await subscription.save();
    await subscription.populate('planId');

    res.json({
      message: 'Subscription successful',
      subscription
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ message: 'Error creating subscription' });
  }
});

// Verify and Activate Payment (called after successful redirect)
router.post('/verify-payment', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;

    // Get the plan details
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Calculate next billing date
    const startDate = new Date();
    const nextBilling = new Date(startDate);

    // Calculate duration in days based on durationType
    let durationInDays = plan.duration;
    if (plan.durationType === 'months') {
      durationInDays = plan.duration * 30; // Approximate
    } else if (plan.durationType === 'years') {
      durationInDays = plan.duration * 365; // Approximate
    }

    nextBilling.setDate(nextBilling.getDate() + durationInDays);

    // Cancel any existing active subscriptions
    await Subscription.updateMany(
      { userId, status: 'active' },
      { status: 'cancelled' }
    );

    // Create new subscription
    const subscription = new Subscription({
      userId,
      planId: plan._id,
      status: 'active',
      startDate,
      nextBilling,
      amount: plan.amount,
      transactionId: `DODO-VERIFY-${Date.now()}-${userId}`, // Temporary ID
      paymentMethod: 'dodo_payments'
    });

    await subscription.save();
    await subscription.populate('planId');

    res.json({
      message: 'Subscription activated successfully',
      subscription
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Error activating subscription' });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    subscription.status = 'cancelled';
    await subscription.save();

    res.json({
      message: 'Subscription cancelled successfully',
      subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Error cancelling subscription' });
  }
});

// Get subscription history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscriptions = await Subscription.find({ userId })
      .populate('planId')
      .sort({ createdAt: -1 });

    res.json({ subscriptions });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Error fetching subscription history' });
  }
});

module.exports = router;
