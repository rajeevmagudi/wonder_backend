const express = require('express');
const router = express.Router();
const SubscriptionPlan = require('../models/subscriptionPlanModel');

// Admin Middleware (will be applied in server.js)
// Get all subscription plans (Public - for displaying to users)
router.get('/', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ amount: 1 });
    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ message: 'Server error fetching subscription plans' });
  }
});

// Get all subscription plans including inactive (Admin only)
router.get('/admin/all', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Error fetching all subscription plans:', error);
    res.status(500).json({ message: 'Server error fetching subscription plans' });
  }
});

// Get single subscription plan
router.get('/:planId', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.planId);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json({
      success: true,
      plan
    });
  } catch (error) {
    console.error('Error fetching subscription plan:', error);
    res.status(500).json({ message: 'Server error fetching subscription plan' });
  }
});

// Create subscription plan (Admin only)
router.post('/admin/create', async (req, res) => {
  try {
    const { name, duration, durationType, amount, originalAmount, discount, features, description, isPopular, dodoProductId } = req.body;

    // Validate required fields
    if (!name || !duration || !amount) {
      return res.status(400).json({ message: 'Name, duration, and amount are required' });
    }

    const plan = new SubscriptionPlan({
      name,
      duration,
      durationType: durationType || 'months',
      amount,
      originalAmount,
      discount,
      features: features || [],
      description,
      isPopular: isPopular || false,
      dodoProductId
    });

    await plan.save();

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      plan
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    res.status(500).json({ message: 'Server error creating subscription plan' });
  }
});

// Update subscription plan (Admin only)
router.put('/admin/:planId', async (req, res) => {
  try {
    const { name, duration, durationType, amount, originalAmount, discount, features, description, isActive, isPopular, dodoProductId } = req.body;

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.planId,
      {
        name,
        duration,
        durationType,
        amount,
        originalAmount,
        discount,
        features,
        description,
        isActive,
        isPopular,
        dodoProductId
      },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      plan
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    res.status(500).json({ message: 'Server error updating subscription plan' });
  }
});

// Delete subscription plan (Admin only)
router.delete('/admin/:planId', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.planId);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    res.status(500).json({ message: 'Server error deleting subscription plan' });
  }
});

// Toggle plan active status (Admin only)
router.patch('/admin/:planId/toggle', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.planId);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.json({
      success: true,
      message: `Subscription plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      plan
    });
  } catch (error) {
    console.error('Error toggling subscription plan status:', error);
    res.status(500).json({ message: 'Server error toggling subscription plan status' });
  }
});

module.exports = router;
