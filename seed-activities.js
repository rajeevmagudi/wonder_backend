// Sample data seed script for activities
// Run with: node seed-activities.js

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import models
const {
  ActivityQuestion,
  ActivityConfig
} = require('./models/activityModels');

// Sample activity configurations
const activityConfigs = [
  {
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
  {
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
  {
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
];

// Sample activity questions
const activityQuestions = [
  // Arrange - Level 1
  {
    id: 'arr-001-1-01',
    activity: 'arrange',
    level: 1,
    question_no: 1,
    version: 1,
    locale: 'en',
    question_items: ['c', 'a', 'b'],
    presentation: {
      shuffle: true,
      display_type: 'drag_drop'
    },
    answer: ['a', 'b', 'c'],
    hints: [
      { type: 'text', value: 'Start with the first letter of the alphabet.', cost: 10 }
    ],
    time_limit_seconds: 30,
    stars_for_perfect: 3,
    difficulty: 'easy',
    assets: {
      audio_prompt: null,
      image_background: null
    },
    analytics_tags: ['letters', 'alphabet', 'ordering']
  },
  {
    id: 'arr-001-1-02',
    activity: 'arrange',
    level: 1,
    question_no: 2,
    version: 1,
    locale: 'en',
    question_items: ['dog', 'cat', 'ant'],
    presentation: {
      shuffle: true,
      display_type: 'drag_drop'
    },
    answer: ['ant', 'cat', 'dog'],
    hints: [
      { type: 'text', value: 'Arrange in alphabetical order.', cost: 10 }
    ],
    time_limit_seconds: 30,
    stars_for_perfect: 3,
    difficulty: 'easy',
    analytics_tags: ['words', 'alphabetical', 'animals']
  },
  {
    id: 'arr-001-1-03',
    activity: 'arrange',
    level: 1,
    question_no: 3,
    version: 1,
    locale: 'en',
    question_items: ['3', '1', '2'],
    presentation: {
      shuffle: true,
      display_type: 'drag_drop'
    },
    answer: ['1', '2', '3'],
    hints: [
      { type: 'text', value: 'Put numbers in order from smallest to largest.', cost: 10 }
    ],
    time_limit_seconds: 30,
    stars_for_perfect: 3,
    difficulty: 'easy',
    analytics_tags: ['numbers', 'counting', 'ordering']
  },
  // Arrange - Level 2
  {
    id: 'arr-001-2-01',
    activity: 'arrange',
    level: 2,
    question_no: 1,
    version: 1,
    locale: 'en',
    question_items: ['zebra', 'apple', 'moon', 'dog', 'book'],
    presentation: {
      shuffle: true,
      display_type: 'drag_drop'
    },
    answer: ['apple', 'book', 'dog', 'moon', 'zebra'],
    hints: [
      { type: 'text', value: 'Arrange all items in alphabetical order.', cost: 10 }
    ],
    time_limit_seconds: 40,
    stars_for_perfect: 3,
    difficulty: 'medium',
    analytics_tags: ['words', 'alphabetical']
  },
  {
    id: 'arr-001-2-02',
    activity: 'arrange',
    level: 2,
    question_no: 2,
    version: 1,
    locale: 'en',
    question_items: ['10', '5', '20', '1', '15'],
    presentation: {
      shuffle: true,
      display_type: 'drag_drop'
    },
    answer: ['1', '5', '10', '15', '20'],
    hints: [
      { type: 'text', value: 'Sort the numbers from smallest to largest.', cost: 10 }
    ],
    time_limit_seconds: 40,
    stars_for_perfect: 3,
    difficulty: 'medium',
    analytics_tags: ['numbers', 'sorting']
  },
  // Match - Level 1
  {
    id: 'match-001-1-01',
    activity: 'match',
    level: 1,
    question_no: 1,
    version: 1,
    locale: 'en',
    question_items: ['A', 'B', 'C'],
    presentation: {
      shuffle: true,
      display_type: 'match'
    },
    answer: ['1', '2', '3'], // Matches: A-1, B-2, C-3
    hints: [
      { type: 'text', value: 'Match each letter to its position number.', cost: 10 }
    ],
    time_limit_seconds: 40,
    stars_for_perfect: 3,
    difficulty: 'easy',
    assets: {
      audio_prompt: null,
      image_background: null
    },
    analytics_tags: ['matching', 'letters', 'numbers']
  },
  {
    id: 'match-001-1-02',
    activity: 'match',
    level: 1,
    question_no: 2,
    version: 1,
    locale: 'en',
    question_items: ['cat', 'dog', 'bird'],
    presentation: {
      shuffle: true,
      display_type: 'match'
    },
    answer: ['meow', 'bark', 'chirp'],
    hints: [
      { type: 'text', value: 'Match each animal with its sound.', cost: 10 }
    ],
    time_limit_seconds: 40,
    stars_for_perfect: 3,
    difficulty: 'easy',
    analytics_tags: ['matching', 'animals', 'sounds']
  },
  // Tap Sequence - Level 1
  {
    id: 'tap-001-1-01',
    activity: 'tap_sequence',
    level: 1,
    question_no: 1,
    version: 1,
    locale: 'en',
    question_items: ['1', '2', '3', '4'],
    presentation: {
      shuffle: true,
      display_type: 'tap_sequence'
    },
    answer: ['1', '2', '3', '4'],
    hints: [
      { type: 'text', value: 'Tap the numbers in order from 1 to 4.', cost: 10 }
    ],
    time_limit_seconds: 25,
    stars_for_perfect: 3,
    difficulty: 'easy',
    analytics_tags: ['sequencing', 'numbers', 'tapping']
  },
  {
    id: 'tap-001-1-02',
    activity: 'tap_sequence',
    level: 1,
    question_no: 2,
    version: 1,
    locale: 'en',
    question_items: ['A', 'B', 'C', 'D', 'E'],
    presentation: {
      shuffle: true,
      display_type: 'tap_sequence'
    },
    answer: ['A', 'B', 'C', 'D', 'E'],
    hints: [
      { type: 'text', value: 'Tap the letters in alphabetical order.', cost: 10 }
    ],
    time_limit_seconds: 30,
    stars_for_perfect: 3,
    difficulty: 'easy',
    analytics_tags: ['sequencing', 'alphabet', 'tapping']
  }
];

async function seedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wonderbot');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing activity data...');
    await ActivityQuestion.deleteMany({});
    await ActivityConfig.deleteMany({});

    // Insert configurations
    console.log('📝 Creating activity configurations...');
    const createdConfigs = await ActivityConfig.insertMany(activityConfigs);
    console.log(`✅ Created ${createdConfigs.length} activity configurations`);
    createdConfigs.forEach(config => {
      console.log(`   - ${config.activity}: ${config.display_name}`);
    });

    // Insert questions
    console.log('📝 Creating activity questions...');
    const createdQuestions = await ActivityQuestion.insertMany(activityQuestions);
    console.log(`✅ Created ${createdQuestions.length} activity questions`);
    
    // Group by activity and level
    const groupedByActivity = {};
    createdQuestions.forEach(q => {
      if (!groupedByActivity[q.activity]) {
        groupedByActivity[q.activity] = {};
      }
      if (!groupedByActivity[q.activity][q.level]) {
        groupedByActivity[q.activity][q.level] = 0;
      }
      groupedByActivity[q.activity][q.level]++;
    });

    Object.entries(groupedByActivity).forEach(([activity, levels]) => {
      console.log(`   📚 ${activity}:`);
      Object.entries(levels).forEach(([level, count]) => {
        console.log(`      Level ${level}: ${count} questions`);
      });
    });

    console.log('\n✨ Seed data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Activity Configs: ${createdConfigs.length}`);
    console.log(`   - Activity Questions: ${createdQuestions.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
