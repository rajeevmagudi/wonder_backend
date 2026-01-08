// Initialize Activity System
// Run with: node init-activity-system.js

const mongoose = require('mongoose');
require('dotenv').config();

const {
  ActivityQuestion,
  UserAttempt,
  UserState,
  ActivityConfig,
  AnalyticsEvent
} = require('./models/activityModels');

async function initializeSystem() {
  try {
    console.log('🚀 Initializing Activity Management System...\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wonderbot');
    console.log('✅ MongoDB connected\n');

    // Check existing collections
    console.log('📊 Checking existing data...');
    const questionCount = await ActivityQuestion.countDocuments();
    const configCount = await ActivityConfig.countDocuments();
    const attemptCount = await UserAttempt.countDocuments();
    const stateCount = await UserState.countDocuments();
    const eventCount = await AnalyticsEvent.countDocuments();

    console.log(`   ActivityQuestions: ${questionCount} documents`);
    console.log(`   ActivityConfigs: ${configCount} documents`);
    console.log(`   UserAttempts: ${attemptCount} documents`);
    console.log(`   UserStates: ${stateCount} documents`);
    console.log(`   AnalyticsEvents: ${eventCount} documents\n`);

    // Create default activity configs if they don't exist
    console.log('🔧 Setting up default activity configurations...');
    const activities = ['arrange', 'match', 'tap_sequence'];
    let configsCreated = 0;

    for (const activity of activities) {
      const existing = await ActivityConfig.findOne({ activity });
      if (!existing) {
        const defaultConfig = {
          arrange: {
            activity: 'arrange',
            display_name: 'Arrange Items',
            description: 'Arrange items in the correct order',
            enabled: true,
            max_levels: 10,
            questions_per_level: 5,
            min_success_rate: 0.7,
            unlock_on_first_success: false,
            stars_system: {
              perfect_time_seconds: 30,
              good_time_seconds: 60,
              pass_time_seconds: 120
            }
          },
          match: {
            activity: 'match',
            display_name: 'Match Pairs',
            description: 'Match items with their corresponding pairs',
            enabled: true,
            max_levels: 10,
            questions_per_level: 5,
            min_success_rate: 0.7,
            unlock_on_first_success: false,
            stars_system: {
              perfect_time_seconds: 40,
              good_time_seconds: 80,
              pass_time_seconds: 150
            }
          },
          tap_sequence: {
            activity: 'tap_sequence',
            display_name: 'Tap Sequence',
            description: 'Tap items in the correct sequence',
            enabled: true,
            max_levels: 10,
            questions_per_level: 5,
            min_success_rate: 0.7,
            unlock_on_first_success: false,
            stars_system: {
              perfect_time_seconds: 25,
              good_time_seconds: 50,
              pass_time_seconds: 100
            }
          }
        };

        await ActivityConfig.create(defaultConfig[activity]);
        configsCreated++;
        console.log(`   ✅ Created config: ${activity}`);
      } else {
        console.log(`   ℹ️  Config exists: ${activity}`);
      }
    }

    if (configsCreated > 0) {
      console.log(`\n✅ Created ${configsCreated} default configuration(s)\n`);
    } else {
      console.log(`✅ All default configurations already exist\n`);
    }

    // Verify indexes
    console.log('🔍 Verifying database indexes...');
    
    try {
      await ActivityQuestion.collection.getIndexes();
      console.log('   ✅ ActivityQuestion indexes: OK');
    } catch (e) {
      console.log('   ⚠️  Issue with ActivityQuestion indexes');
    }

    try {
      await UserAttempt.collection.getIndexes();
      console.log('   ✅ UserAttempt indexes: OK');
    } catch (e) {
      console.log('   ⚠️  Issue with UserAttempt indexes');
    }

    try {
      await AnalyticsEvent.collection.getIndexes();
      console.log('   ✅ AnalyticsEvent indexes: OK');
    } catch (e) {
      console.log('   ⚠️  Issue with AnalyticsEvent indexes');
    }

    console.log('');

    // Display system status
    console.log('📈 System Status:');
    console.log(`   Total Questions: ${questionCount}`);
    console.log(`   Total Configs: ${configCount + configsCreated}`);
    console.log(`   Total Attempts: ${attemptCount}`);
    console.log(`   Active Users: ${stateCount}`);
    console.log(`   Analytics Events: ${eventCount}`);

    console.log('\n✨ Activity Management System initialized successfully!\n');

    console.log('📚 Next Steps:');
    console.log('   1. Run seed script: node seed-activities.js');
    console.log('   2. Start backend: npm run dev');
    console.log('   3. Start frontend: npm start (in frontend/wonderbot)');
    console.log('   4. Login to admin dashboard');
    console.log('   5. Navigate to 🎮 Activities tab\n');

    console.log('📖 Documentation:');
    console.log('   - API Docs: ACTIVITY_API_DOCS.md');
    console.log('   - Quick Start: ACTIVITY_QUICK_START.md');
    console.log('   - Implementation: ACTIVITY_IMPLEMENTATION_SUMMARY.md\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing system:', error);
    process.exit(1);
  }
}

initializeSystem();
