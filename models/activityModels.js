const mongoose = require('mongoose');

// Hint Schema
const HintSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['text', 'reveal', 'audio'], 
    required: true 
  },
  value: { 
    type: String, 
    required: true 
  },
  cost: { 
    type: Number, 
    default: 0 
  }
}, { _id: false });

// Presentation Schema
const PresentationSchema = new mongoose.Schema({
  shuffle: { 
    type: Boolean, 
    default: true 
  },
  display_type: { 
    type: String, 
    enum: ['drag_drop', 'tap_sequence', 'multiple_choice', 'match', 'image_text', 'text_image'], 
    default: 'drag_drop' 
  }
}, { _id: false });

// Progression Schema
const ProgressionSchema = new mongoose.Schema({
  on_success: {
    next_level: { type: Number },
    next_q_no: { type: Number }
  },
  on_fail: {
    next_level: { type: Number },
    next_q_no: { type: Number },
    retry_limit: { type: Number, default: 3 }
  }
}, { _id: false });

// Activity Question Schema - Master content for every question
const ActivityQuestionSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true 
  }, // e.g. arr-001-1-01
  activity: { 
    type: String, 
    required: true, 
    index: true 
  }, // 'arrange', 'match', 'tap_sequence', etc.
  level: { 
    type: Number, 
    required: true, 
    index: true 
  },
  question_no: { 
    type: Number, 
    required: true 
  },
  version: { 
    type: Number, 
    default: 1 
  },
  locale: { 
    type: String, 
    default: 'en' 
  },
  question_items: { 
    type: [String], 
    required: true 
  }, // canonical items (e.g. ["c","a","b"])
  presentation: { 
    type: PresentationSchema, 
    default: () => ({}) 
  },
  answer: { 
    type: [String], 
    required: true 
  }, // canonical answer array ["a","b","c"]
  hints: { 
    type: [HintSchema], 
    default: [] 
  },
  time_limit_seconds: { 
    type: Number, 
    default: 0 
  },
  stars_for_perfect: { 
    type: Number, 
    default: 3 
  },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    default: 'easy' 
  },
  assets: {
    audio_prompt: { type: String },
    image_background: { type: String }
  },
  image_url: { 
    type: String, 
    default: '' 
  }, // For image_text and text_image display types
  question_text: { 
    type: String, 
    default: '' 
  }, // Question text to display with image
  match_pairs: [{
    question_image: { type: String },
    question_value: { type: String },
    answer_image: { type: String },
    answer_value: { type: String }
  }], // For match display type with image pairs
  progression: { 
    type: ProgressionSchema, 
    default: () => ({}) 
  },
  analytics_tags: { 
    type: [String], 
    default: [] 
  },
  created_at: { 
    type: Date, 
    default: () => new Date() 
  },
  updated_at: { 
    type: Date, 
    default: () => new Date() 
  }
}, {
  timestamps: false
});

// Compound index for fast lookups by activity+level
ActivityQuestionSchema.index({ activity: 1, level: 1, question_no: 1 });

// User Attempt Schema - Per-user attempts & progress (immutable attempts)
const UserAttemptSchema = new mongoose.Schema({
  user_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  activity_question_id: { 
    type: String, 
    required: true, 
    index: true 
  }, // id from ActivityQuestion
  activity: { 
    type: String, 
    required: true 
  },
  level: { 
    type: Number 
  },
  question_no: { 
    type: Number 
  },
  attempt_order: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  }, // what user submitted - can be array or object (for match type)
  success: { 
    type: Boolean, 
    required: true 
  },
  time_taken_seconds: { 
    type: Number, 
    default: 0 
  },
  hints_used: { 
    type: Number, 
    default: 0 
  },
  stars_earned: { 
    type: Number, 
    default: 0 
  },
  client_metadata: { 
    type: Object, 
    default: {} 
  }, // device, app_version etc.
  created_at: { 
    type: Date, 
    default: () => new Date() 
  }
});

UserAttemptSchema.index({ user_id: 1, activity_question_id: 1, created_at: -1 });

// User State Schema - Current unlocked levels, last question pointers
const UserStateSchema = new mongoose.Schema({
  user_id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  unlocked: { // example: { arrange: { level: 1, highest_q_no: 5 } }
    type: Object,
    default: {}
  },
  last_played: { 
    type: Date, 
    default: null 
  },
  created_at: { 
    type: Date, 
    default: () => new Date() 
  },
  updated_at: { 
    type: Date, 
    default: () => new Date() 
  }
}, {
  timestamps: false
});

// Activity Config Schema - Global progression rules, level configs
const ActivityConfigSchema = new mongoose.Schema({
  activity: { 
    type: String, 
    required: true, 
    unique: true 
  }, // 'arrange', 'match', etc.
  display_name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  enabled: { 
    type: Boolean, 
    default: true 
  },
  max_levels: { 
    type: Number, 
    default: 10 
  },
  questions_per_level: { 
    type: Number, 
    default: 5 
  },
  min_success_rate: { 
    type: Number, 
    default: 0.7 
  }, // 70% to unlock next level
  unlock_on_first_success: { 
    type: Boolean, 
    default: false 
  }, // unlock next level after first success
  stars_system: {
    perfect_time_seconds: { type: Number, default: 30 },
    good_time_seconds: { type: Number, default: 60 },
    pass_time_seconds: { type: Number, default: 120 }
  },
  level_configs: { 
    type: Object, 
    default: {} 
  }, // custom per-level configs
  created_at: { 
    type: Date, 
    default: () => new Date() 
  },
  updated_at: { 
    type: Date, 
    default: () => new Date() 
  }
}, {
  timestamps: false
});

// Analytics Event Schema - Raw events for event-based analytics
const AnalyticsEventSchema = new mongoose.Schema({
  user_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  event_type: { 
    type: String, 
    required: true, 
    index: true 
  }, // 'question_started', 'hint_used', 'attempt_completed', etc.
  activity: { 
    type: String 
  },
  level: { 
    type: Number 
  },
  question_no: { 
    type: Number 
  },
  data: { 
    type: Object, 
    default: {} 
  },
  client_metadata: { 
    type: Object, 
    default: {} 
  },
  created_at: { 
    type: Date, 
    default: () => new Date(), 
    index: true 
  }
});

AnalyticsEventSchema.index({ user_id: 1, created_at: -1 });
AnalyticsEventSchema.index({ event_type: 1, created_at: -1 });

// Create models
const ActivityQuestion = mongoose.model('ActivityQuestion', ActivityQuestionSchema);
const UserAttempt = mongoose.model('UserAttempt', UserAttemptSchema);
const UserState = mongoose.model('UserState', UserStateSchema);
const ActivityConfig = mongoose.model('ActivityConfig', ActivityConfigSchema);
const AnalyticsEvent = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);

module.exports = {
  ActivityQuestion,
  UserAttempt,
  UserState,
  ActivityConfig,
  AnalyticsEvent,
  // Schemas
  HintSchema,
  PresentationSchema,
  ProgressionSchema,
  ActivityQuestionSchema,
  UserAttemptSchema,
  UserStateSchema,
  ActivityConfigSchema,
  AnalyticsEventSchema
};
