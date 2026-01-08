const mongoose = require('mongoose');
const Subscription = mongoose.model('Subscription');

// Middleware to check if user has an active subscription
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    });

    // No subscription found
    if (!subscription) {
      return res.status(403).json({
        message: 'Active subscription required',
        subscriptionRequired: true
      });
    }

    // Check if subscription has expired
    const currentDate = new Date();
    const nextBillingDate = new Date(subscription.nextBilling);

    if (currentDate > nextBillingDate) {
      // Subscription has expired
      subscription.status = 'expired';
      await subscription.save();

      return res.status(403).json({
        message: 'Subscription has expired',
        subscriptionRequired: true,
        expired: true
      });
    }

    // Subscription is valid
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ message: 'Error checking subscription status' });
  }
};

// Middleware to check subscription but allow access (just adds subscription info)
const checkSubscriptionOptional = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    });

    if (subscription) {
      // Check if subscription has expired
      const currentDate = new Date();
      const nextBillingDate = new Date(subscription.nextBilling);

      if (currentDate > nextBillingDate) {
        subscription.status = 'expired';
        await subscription.save();
        req.subscription = null;
      } else {
        req.subscription = subscription;
      }
    } else {
      req.subscription = null;
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    req.subscription = null;
    next();
  }
};

module.exports = {
  checkSubscription,
  checkSubscriptionOptional
};
