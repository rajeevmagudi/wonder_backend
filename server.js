const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
require('dotenv').config();

// Firebase Admin initialization
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      })
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
} else {
  console.warn('⚠️ Firebase Admin not initialized - missing environment variables');
}

// Import models first (before middleware that uses them)
const Subscription = require('./models/subscriptionModel');
const SubscriptionPlan = require('./models/subscriptionPlanModel');

const { checkSubscription, checkSubscriptionOptional } = require('./middleware/subscriptionMiddleware');
const activityRoutes = require('./routes/activityRoutes');
const subscriptionPlanRoutes = require('./routes/subscriptionPlanRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const affiliateRoutes = require('./routes/affiliateRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { AffiliateProgram, AffiliateLink, AffiliateClick } = require('./models/affiliateModel');

const app = express();

// Middleware
// app.use(cors());
app.use(cors({
  origin: [
    "https://wonder-coral.vercel.app/", "https://wobokids.com/",
    "http://localhost:3000" // React local
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Special handling for DODO webhooks - must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
// Add COOP/COEP for Firebase Auth popups
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const ebooksDir = path.join(uploadsDir, 'ebooks');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
const audioDir = path.join(uploadsDir, 'audio');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(ebooksDir)) {
  fs.mkdirSync(ebooksDir);
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}

// MongoDB Connection
// (Connection moved to after model definitions)

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

// Multer storage for ebooks (PDF only)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, ebooksDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}_${safeOriginal}`);
  }
});

// Multer storage for thumbnails
const thumbnailStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, thumbnailsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}_thumb_${safeOriginal}`);
  }
});

const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, WebP) are allowed'));
  }
};

// Multer storage for audio files
const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}_${safeOriginal}`);
  }
});

const audioFileFilter = (req, file, cb) => {
  const allowedMimes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files (MP3, WAV, OGG, M4A, WebM, FLAC) are allowed'));
  }
};

const uploadPdf = multer({ storage, fileFilter: pdfFileFilter, limits: { fileSize: 20 * 1024 * 1024 } });
const uploadThumbnail = multer({ storage: thumbnailStorage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAudio = multer({ storage: audioStorage, fileFilter: audioFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ username: 'admin' });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('Magudi@123', 10);

      const adminUser = new User({
        username: 'admin',
        email: 'admin@magudi.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Default admin user created successfully');
      console.log('📧 Username: admin');
      console.log('🔑 Password: Magudi@123');
      console.log('📬 Email: admin@wonderbot.com');
    } else {
      console.log('ℹ️  Default admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating default admin user:', error);
  }
};

const createDefaultAffiliateProgram = async () => {
  try {
    const programExists = await AffiliateProgram.findOne({ name: 'WoBoKids Referral Program' });
    if (!programExists) {
      const program = new AffiliateProgram({
        name: 'WoBoKids Referral Program',
        description: 'Earn rewards by inviting your friends to WoBoKids!',
        commissionRate: 10,
        isActive: true
      });
      await program.save();
      console.log('✅ Default affiliate program created');
    }
  } catch (error) {
    console.error('❌ Error creating default affiliate program:', error);
  }
};

// Initialize default admin after MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://magudi:WB@magudi.123@cluster0.j3ccece.mongodb.net/?appName=Cluster0')
  .then(() => {
    console.log('MongoDB connected');
    createDefaultAdmin();
    createDefaultAffiliateProgram();
  })
  .catch(err => console.log('MongoDB connection error:', err));

// JWT Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  // 1. Try Local JWT verification first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (jwtErr) {
    // 2. If local JWT fails, try Firebase token verification
    if (admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        // Find user by email from firebase token
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

// Admin Middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    let userId;
    let decoded;

    // 1. Try Local JWT
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (jwtErr) {
      // 2. Try Firebase
      if (admin.apps.length > 0) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await User.findOne({ email: decodedToken.email });
        if (user) {
          userId = user._id;
          decoded = { userId, username: user.username, role: user.role };
        } else {
          throw new Error('User not found');
        }
      } else {
        throw jwtErr;
      }
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = { ...decoded, role: user.role };
    req.adminUser = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registering new user:', req.body);
    const { username, email, password, referralCode } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      username,
      email,
      password: hashedPassword
    };

    // Handle referral
    let affiliateLink = null;
    if (referralCode) {
      affiliateLink = await AffiliateLink.findOne({ code: referralCode });
      if (affiliateLink) {
        userData.referredBy = affiliateLink.userId;
      }
    }

    const user = new User(userData);
    await user.save();

    if (affiliateLink) {
      affiliateLink.conversions += 1;
      // You could also add commission calculation here
      await affiliateLink.save();

      // Update click record to 'signed_up'
      await AffiliateClick.create({
        affiliateLinkId: affiliateLink._id,
        referredUserId: user._id,
        status: 'signed_up',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }

    // Create 7-day trial subscription for new user
    try {
      // Find the 7-day trial plan
      const freeTrialPlan = await SubscriptionPlan.findOne({
        name: '7-Day Trial',
        isActive: true
      });

      if (freeTrialPlan) {
        const startDate = new Date();
        const nextBilling = new Date(startDate);
        nextBilling.setDate(nextBilling.getDate() + 7);

        const subscription = new Subscription({
          userId: user._id,
          planId: freeTrialPlan._id,
          status: 'active',
          startDate,
          nextBilling,
          amount: 0,
          transactionId: `FREE-TRIAL-${Date.now()}-${user._id}`
        });

        await subscription.save();
        console.log('✅ Created 7-day trial subscription for new user');
      } else {
        console.warn('⚠️ 7-Day Trial plan not found - user registered without subscription');
      }
    } catch (subError) {
      console.error('❌ Error creating free trial subscription:', subError);
      // Don't fail registration if subscription creation fails
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔑 Logging in user:', req.body);
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT with role
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Firebase Auth
app.post('/api/auth/firebase', async (req, res) => {
  try {
    console.log('📬 Received Firebase login request');
    const { idToken, referralCode } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }

    if (admin.apps.length === 0) {
      console.error('❌ Firebase Admin not initialized');
      return res.status(500).json({ message: 'Firebase authentication is not configured on the server' });
    }

    // Verify token
    console.log('🔍 Verifying Firebase ID token...');
    console.time('firebase_verify');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.timeEnd('firebase_verify');
    console.log('✅ Token verified for email:', decodedToken.email);
    const { email, name, picture, uid } = decodedToken;

    if (!email) {
      return res.status(400).json({ message: 'Email not provided by Firebase' });
    }

    // Find or create user
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Generate a random username if not provided
      const baseUsername = name ? name.replace(/\s+/g, '').toLowerCase() : email.split('@')[0];
      let username = baseUsername;

      // Ensure username is unique
      let usernameExists = await User.findOne({ username });
      let counter = 1;
      while (usernameExists) {
        username = `${baseUsername}${counter}`;
        usernameExists = await User.findOne({ username });
        counter++;
      }

      // Create new user
      const userData = {
        username,
        email,
        // Since it's social login, password is required by schema but not used
        password: await bcrypt.hash(Math.random().toString(36).slice(-10), 10),
        role: 'user'
      };

      // Handle referral for Firebase users
      let affiliateLink = null;
      if (referralCode) {
        affiliateLink = await AffiliateLink.findOne({ code: referralCode });
        if (affiliateLink) {
          userData.referredBy = affiliateLink.userId;
        }
      }

      user = new User(userData);

      await user.save();
      console.log('✅ Created new user from Firebase:', email);

      if (affiliateLink) {
        affiliateLink.conversions += 1;
        await affiliateLink.save();

        await AffiliateClick.create({
          affiliateLinkId: affiliateLink._id,
          referredUserId: user._id,
          status: 'signed_up',
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      // Create 7-day trial subscription (Copied from register route)
      try {
        const freeTrialPlan = await SubscriptionPlan.findOne({
          name: '7-Day Trial',
          isActive: true
        });

        if (freeTrialPlan) {
          const startDate = new Date();
          const nextBilling = new Date(startDate);
          nextBilling.setDate(nextBilling.getDate() + 7);

          const subscription = new Subscription({
            userId: user._id,
            planId: freeTrialPlan._id,
            status: 'active',
            startDate,
            nextBilling,
            amount: 0,
            transactionId: `FIREBASE-TRIAL-${Date.now()}-${user._id}`
          });

          await subscription.save();
          console.log('✅ Created 7-day trial subscription for new Firebase user');
        }
      } catch (subError) {
        console.error('❌ Error creating free trial for Firebase user:', subError);
      }
    }

    // Generate local JWT
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: isNewUser ? 'Account created and logged in' : 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Firebase Auth Error:', error);
    res.status(401).json({ message: 'Authentication failed', error: error.message });
  }
});

// Protected route example
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout (client-side token removal)
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// Admin Routes

// Get all users (Admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      users,
      totalUsers: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Get all subscriptions (Admin only)
app.get('/api/admin/subscriptions', authenticateAdmin, async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });

    const stats = await Subscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      subscriptions,
      stats,
      totalSubscriptions: subscriptions.length
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ message: 'Server error fetching subscriptions' });
  }
});

// Get dashboard stats (Admin only)
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalSubscriptions = await Subscription.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });

    const revenueData = await Subscription.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          averageRevenue: { $avg: '$amount' }
        }
      }
    ]);

    const monthlySignups = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalSubscriptions,
        activeSubscriptions,
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        averageRevenue: revenueData[0]?.averageRevenue || 0,
        monthlySignups
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
});

// Update user status (Admin only)
app.patch('/api/admin/users/:userId/status', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
});

// Delete user (Admin only)
app.delete('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow admin to delete themselves
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Also delete user's subscriptions
    await Subscription.deleteMany({ userId });

    res.json({
      success: true,
      message: 'User and associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// Create new user (Admin only)
app.post('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role,
      isActive: true
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// Ebooks Routes

// Upload thumbnail for ebook (Admin only) - MUST come before main upload
app.post('/api/ebooks/upload-thumbnail', authenticateAdmin, uploadThumbnail.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No thumbnail uploaded' });
    }

    // Store relative path instead of full URL
    const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      thumbnail: {
        filename: req.file.filename,
        url: thumbnailUrl,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    return res.status(500).json({ message: 'Server error uploading thumbnail' });
  }
});

// Upload a storybook PDF with thumbnail (Admin only)
app.post('/api/ebooks/upload', authenticateAdmin, uploadPdf.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if thumbnail exists in body
    let thumbnailUrl = null;
    if (req.body.thumbnailUrl) {
      // Thumbnail URL is provided by client (already uploaded or encoded)
      thumbnailUrl = req.body.thumbnailUrl;
    }

    // Store relative path instead of full URL
    const fileUrl = `/uploads/ebooks/${req.file.filename}`;

    // Store ebook metadata
    const ebookData = {
      title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      storedName: req.file.filename,
      size: req.file.size,
      url: fileUrl,
      thumbnailUrl: thumbnailUrl,
      uploadedAt: new Date()
    };

    // Create a metadata file to persist ebook data
    const metadataPath = path.join(ebooksDir, `${req.file.filename}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(ebookData, null, 2));

    return res.status(201).json({
      success: true,
      message: 'Ebook uploaded successfully',
      file: ebookData
    });
  } catch (error) {
    console.error('Ebook upload error:', error);
    return res.status(500).json({ message: 'Server error uploading ebook' });
  }
});

// List all ebooks (public)
app.get('/api/ebooks', async (req, res) => {
  try {
    const files = fs.readdirSync(ebooksDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));

    const items = files.map(filename => {
      const fullPath = path.join(ebooksDir, filename);
      const stats = fs.statSync(fullPath);

      // Try to load metadata with relative paths
      let metadata = {
        storedName: filename,
        name: filename.replace(/^\d+_/, ''),
        title: filename.replace(/^\d+_/, '').replace(/\.[^/.]+$/, ''),
        size: stats.size,
        url: `/uploads/ebooks/${filename}`,
        thumbnailUrl: null,
        uploadedAt: stats.mtime
      };

      const metadataPath = `${fullPath}.json`;
      if (fs.existsSync(metadataPath)) {
        try {
          const stored = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          metadata = { ...metadata, ...stored };
        } catch (e) {
          console.log('Could not parse metadata for', filename);
        }
      }

      return metadata;
    }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.json({ success: true, ebooks: items });
  } catch (error) {
    console.error('List ebooks error:', error);
    return res.status(500).json({ message: 'Server error listing ebooks' });
  }
});

// ==================== AUDIO STORIES ROUTES ====================

// Upload audio story (Admin only)
app.post('/api/audio-stories/upload', authenticateAdmin, uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    // Check if thumbnail exists in body
    let thumbnailUrl = null;
    if (req.body.thumbnailUrl) {
      thumbnailUrl = req.body.thumbnailUrl;
    }

    // Store relative path instead of full URL
    const fileUrl = `uploads/audio/${req.file.filename}`;

    // Store audio story metadata
    const audioData = {
      title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      description: req.body.description || '',
      storedName: req.file.filename,
      size: req.file.size,
      url: fileUrl,
      thumbnailUrl: thumbnailUrl,
      uploadedAt: new Date()
    };

    // Create a metadata file to persist audio data
    const metadataPath = path.join(audioDir, `${req.file.filename}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(audioData, null, 2));

    return res.status(201).json({
      success: true,
      message: 'Audio story uploaded successfully',
      file: audioData
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    return res.status(500).json({ message: 'Server error uploading audio story' });
  }
});

// Upload thumbnail for audio story (Admin only)
app.post('/api/audio-stories/upload-thumbnail', authenticateAdmin, uploadThumbnail.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No thumbnail uploaded' });
    }

    // Store relative path instead of full URL
    const thumbnailUrl = `uploads/thumbnails/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      thumbnail: {
        filename: req.file.filename,
        url: thumbnailUrl,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    return res.status(500).json({ message: 'Server error uploading thumbnail' });
  }
});

// List all audio stories (public)
app.get('/api/audio-stories', async (req, res) => {
  try {
    const files = fs.readdirSync(audioDir)
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac'].includes(ext);
      });

    const items = files.map(filename => {
      const fullPath = path.join(audioDir, filename);
      const stats = fs.statSync(fullPath);

      // Try to load metadata with relative paths
      let metadata = {
        storedName: filename,
        name: filename.replace(/^\d+_/, ''),
        title: filename.replace(/^\d+_/, '').replace(/\.[^/.]+$/, ''),
        description: '',
        size: stats.size,
        url: `uploads/audio/${filename}`,
        thumbnailUrl: null,
        uploadedAt: stats.mtime
      };

      const metadataPath = `${fullPath}.json`;
      if (fs.existsSync(metadataPath)) {
        try {
          const stored = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          metadata = { ...metadata, ...stored };
        } catch (e) {
          console.log('Could not parse metadata for', filename);
        }
      }

      return metadata;
    }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.json({ success: true, audioStories: items });
  } catch (error) {
    console.error('List audio stories error:', error);
    return res.status(500).json({ message: 'Server error listing audio stories' });
  }
});

// Delete audio story (Admin only)
app.delete('/api/audio-stories/:filename', authenticateAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(audioDir, filename);
    const metadataPath = `${filePath}.json`;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Audio file not found' });
    }

    // Delete audio file
    fs.unlinkSync(filePath);

    // Delete metadata if exists
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }

    return res.json({
      success: true,
      message: 'Audio story deleted successfully'
    });
  } catch (error) {
    console.error('Delete audio error:', error);
    return res.status(500).json({ message: 'Server error deleting audio story' });
  }
});

// ==================== SUBSCRIPTION ROUTES ====================
app.use('/api/subscription', authenticateToken, subscriptionRoutes);

// Removed inline subscription routes - now using subscriptionRoutes.js
// (keeping for reference)
/*
app.post('/api/subscription/subscribe', authenticateToken, async (req, res) => {
  try {
    const { planId, plan, amount } = req.body;
    const userId = req.user.userId;

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      status: 'active'
    });

    if (existingSubscription) {
      return res.status(400).json({
        message: 'You already have an active subscription'
      });
    }

    let subscriptionPlan = null;
    let finalAmount = amount;
    let duration = 1; // default 1 month
    let durationType = 'months';

    // If planId is provided, fetch plan details
    if (planId) {
      const SubscriptionPlan = require('./models/subscriptionPlanModel');
      subscriptionPlan = await SubscriptionPlan.findById(planId);
      
      if (!subscriptionPlan || !subscriptionPlan.isActive) {
        return res.status(400).json({
          message: 'Invalid or inactive subscription plan'
        });
      }

      finalAmount = subscriptionPlan.amount;
      duration = subscriptionPlan.duration;
      durationType = subscriptionPlan.durationType;
    }

    // Calculate next billing date
    const startDate = new Date();
    const nextBilling = new Date(startDate);
    
    if (durationType === 'days') {
      nextBilling.setDate(nextBilling.getDate() + duration);
    } else if (durationType === 'months') {
      nextBilling.setMonth(nextBilling.getMonth() + duration);
    } else if (durationType === 'years') {
      nextBilling.setFullYear(nextBilling.getFullYear() + duration);
    } else if (plan === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else if (plan === 'yearly') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }

    // Create subscription
    const subscription = new Subscription({
      userId,
      plan: subscriptionPlan ? subscriptionPlan.name : plan,
      planId: subscriptionPlan ? subscriptionPlan._id : null,
      amount: finalAmount,
      startDate,
      nextBilling,
      status: 'active'
    });

    await subscription.save();

    // Simulate payment processing (in real app, integrate with Stripe, PayPal, etc.)
    const payment = {
      id: `pay_${Date.now()}`,
      amount: finalAmount,
      currency: 'USD',
      status: 'completed',
      date: new Date()
    };

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription,
      payment
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: 'Server error during subscription' });
  }
});
*/

/* Get subscription status
app.get('/api/subscription/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'cancelled'] }
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({
        subscription: null,
        message: 'No subscription found'
      });
    }

    // Check if subscription is expired
    if (subscription.status === 'active' && new Date() > subscription.nextBilling) {
      subscription.status = 'expired';
      await subscription.save();
    }

    res.json({
      subscription
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Server error fetching subscription' });
  }
});

Cancel subscription
app.post('/api/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        message: 'No active subscription found'
      });
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    res.json({
      message: 'Subscription cancelled successfully',
      subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Server error cancelling subscription' });
  }
});
*/

// ==================== ACTIVITY ROUTES ====================
// Use activity routes with authentication middleware
app.use('/api/activities', activityRoutes);

// Use affiliate routes
app.use('/api/affiliate', affiliateRoutes(authenticateToken, authenticateAdmin));

// Use payment routes
app.use('/api/payments', paymentRoutes);

// Use subscription routes
app.use('/api/subscription', authenticateToken, subscriptionRoutes);

// ==================== SUBSCRIPTION PLAN ROUTES ====================
// Public routes for viewing plans
app.use('/api/subscription-plans', subscriptionPlanRoutes);
// Admin routes for managing plans (protected in route file)
app.use('/api/subscription-plans/admin', authenticateAdmin, subscriptionPlanRoutes);

// ==================== YOUTUBE API ROUTES ====================
// YouTube API configuration endpoint
app.get('/api/youtube/config', authenticateToken, (req, res) => {
  try {
    res.json({
      apiKey: process.env.YOUTUBE_API_KEY || 'AIzaSyAJtW_GqL1sRC2BXvnh0UzOcX8_ihUKm0A',
      channelId: process.env.YOUTUBE_CHANNEL_ID || 'UCHcMatp49Qeh6w82fqTZhMQ' // Add channel ID if needed
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get YouTube configuration', error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
