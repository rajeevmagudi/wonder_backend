const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const {
  ActivityQuestion,
  UserAttempt,
  UserState,
  ActivityConfig,
  AnalyticsEvent
} = require('../models/activityModels');

// Middleware for authentication (should be imported from server.js)
// These routes should be protected and receive authenticateToken/authenticateAdmin

// ==================== IMAGE UPLOAD ====================

// Multer storage for activity images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/activity-images');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
  }
};

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Admin: Upload image for activity question
router.post('/admin/upload-image', uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    // Generate URL for the uploaded image
    const imageUrl = `/uploads/activity-images/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Server error uploading image' });
  }
});

// ==================== ACTIVITY QUESTIONS ====================

const importFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  const allowedExtensions = ['.json', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JSON and Excel files are allowed.'));
  }
};

const uploadImport = multer({
  storage: multer.memoryStorage(), // Store in memory to parse immediately
  fileFilter: importFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Admin: Import questions from JSON or Excel
router.post('/admin/questions/import', uploadImport.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let questionsToImport = [];
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.json') {
      try {
        const jsonData = JSON.parse(req.file.buffer.toString());
        questionsToImport = Array.isArray(jsonData) ? jsonData : [jsonData];
      } catch (err) {
        return res.status(400).json({ message: 'Invalid JSON format' });
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        questionsToImport = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid Excel format' });
      }
    }

    if (questionsToImport.length === 0) {
      return res.status(400).json({ message: 'No questions found in file' });
    }

    // Process and validate questions
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const qData of questionsToImport) {
      try {
        // Handle potential JSON fields within Excel
        if (typeof qData.question_items === 'string') {
          try { qData.question_items = JSON.parse(qData.question_items); } catch (e) { }
        }
        if (typeof qData.answer === 'string') {
          if (qData.answer.startsWith('[') || qData.answer.startsWith('{')) {
            try { qData.answer = JSON.parse(qData.answer); } catch (e) { }
          }
        }
        if (typeof qData.match_pairs === 'string') {
          try { qData.match_pairs = JSON.parse(qData.match_pairs); } catch (e) { }
        }
        if (typeof qData.presentation === 'string') {
          try { qData.presentation = JSON.parse(qData.presentation); } catch (e) { }
        }
        if (typeof qData.hints === 'string') {
          try { qData.hints = JSON.parse(qData.hints); } catch (e) { }
        }

        // Upsert based on 'id' if provided, otherwise create new
        if (qData.id) {
          await ActivityQuestion.findOneAndUpdate(
            { id: qData.id },
            qData,
            { upsert: true, new: true, runValidators: true }
          );
        } else {
          const newQ = new ActivityQuestion(qData);
          await newQ.save();
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Row/ID ${qData.id || 'unknown'}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Import processed. Success: ${results.success}, Failed: ${results.failed}`,
      results
    });

  } catch (error) {
    console.error('Import questions error:', error);
    res.status(500).json({ message: 'Server error parsing import file' });
  }
});

// Admin: Create activity question
router.post('/admin/questions', async (req, res) => {
  try {
    const questionData = req.body;

    // Validate required fields
    if (!questionData.id || !questionData.activity || questionData.level === undefined || !questionData.question_no) {
      return res.status(400).json({ message: 'Missing required fields: id, activity, level, question_no' });
    }

    const question = new ActivityQuestion(questionData);
    await question.save();

    res.status(201).json({
      success: true,
      message: 'Activity question created successfully',
      question
    });
  } catch (error) {
    console.error('Create question error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Question ID already exists' });
    }
    res.status(500).json({ message: 'Server error creating question' });
  }
});

// Admin: Get all activity questions with filters
router.get('/admin/questions', async (req, res) => {
  try {
    const { activity, level, locale, page, limit, search } = req.query;
    const filter = {};

    if (activity) filter.activity = activity;
    if (level) filter.level = parseInt(level);
    if (locale) filter.locale = locale;
    if (search) {
      filter.$or = [
        { question_text: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } },
        { activity: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await ActivityQuestion.countDocuments(filter);

    const questionsData = await ActivityQuestion.find(filter)
      .sort({ level: 1, question_no: 1 })
      .skip(skip)
      .limit(limitNum);

    // Transform questions to match frontend expectations
    const questions = questionsData.map(q => ({
      _id: q._id,
      id: q.id,
      activity: q.activity,
      level: q.level,
      question_no: q.question_no,
      question_items: q.question_items,
      answer: q.answer,
      difficulty: q.difficulty,
      time_limit_seconds: q.time_limit_seconds,
      stars_for_perfect: q.stars_for_perfect,
      presentation: q.presentation,
      hints: q.hints,
      assets: q.assets,
      // Include image_url and question_text from database
      image_url: q.image_url || '',
      question_text: q.question_text || '',
      // Include match_pairs for match display type
      match_pairs: q.match_pairs || [],
      // Map activity data to frontend expected fields
      content_type: q.presentation?.display_type || 'drag_drop',
      options: q.question_items,
      version: q.version,
      locale: q.locale
    }));

    res.json({
      success: true,
      count: questions.length,
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      questions
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Server error fetching questions' });
  }
});

// Admin: Get single activity question
router.get('/admin/questions/:questionId', async (req, res) => {
  try {
    const question = await ActivityQuestion.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      success: true,
      question
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ message: 'Server error fetching question' });
  }
});

// Admin: Update activity question
router.put('/admin/questions/:questionId', async (req, res) => {
  try {
    const question = await ActivityQuestion.findByIdAndUpdate(
      req.params.questionId,
      { ...req.body, updated_at: new Date() },
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      success: true,
      message: 'Question updated successfully',
      question
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ message: 'Server error updating question' });
  }
});

// Admin: Delete activity question
router.delete('/admin/questions/:questionId', async (req, res) => {
  try {
    const question = await ActivityQuestion.findByIdAndDelete(req.params.questionId);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Clean up related attempts
    await UserAttempt.deleteMany({ activity_question_id: question.id });

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ message: 'Server error deleting question' });
  }
});

// ==================== USER ATTEMPTS ====================

// User: Submit attempt for a question
router.post('/attempts', async (req, res) => {
  try {
    const { user_id, activity_question_id, attempt_order, time_taken_seconds, hints_used, client_metadata } = req.body;

    // Find the question
    const question = await ActivityQuestion.findOne({ id: activity_question_id });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Get activity config for timing thresholds
    const config = await ActivityConfig.findOne({ activity: question.activity });
    const timingConfig = config?.stars_system || { perfect_time_seconds: 30, good_time_seconds: 60 };

    // Check if attempt is correct
    // Handle both array and string answers
    let success = false;
    const questionAnswer = question.answer;

    // Special handling for match display type
    if (question.presentation?.display_type === 'match' && question.match_pairs) {
      // For match type, attempt_order is an object: { questionValue: answerValue }
      // Validate each match against the correct pairs
      if (typeof attempt_order === 'object' && !Array.isArray(attempt_order)) {
        success = true;
        for (const pair of question.match_pairs) {
          if (attempt_order[pair.question_value] !== pair.answer_value) {
            success = false;
            break;
          }
        }
      }
    } else if (Array.isArray(questionAnswer) && questionAnswer.length === 1) {
      // If answer is single-element array, compare with first element or the string itself
      success = attempt_order === questionAnswer[0] || JSON.stringify(attempt_order) === JSON.stringify(questionAnswer);
    } else {
      // For other cases, use JSON comparison
      success = JSON.stringify(attempt_order) === JSON.stringify(questionAnswer);
    }

    // Calculate stars
    let stars_earned = 0;
    if (success) {
      if (time_taken_seconds <= timingConfig.perfect_time_seconds) {
        stars_earned = question.stars_for_perfect;
      } else if (time_taken_seconds <= timingConfig.good_time_seconds) {
        stars_earned = Math.ceil(question.stars_for_perfect * 0.8);
      } else {
        stars_earned = 1;
      }
    }

    // Create attempt record
    const attempt = new UserAttempt({
      user_id,
      activity_question_id,
      activity: question.activity,
      level: question.level,
      question_no: question.question_no,
      attempt_order,
      success,
      time_taken_seconds,
      hints_used,
      stars_earned,
      client_metadata
    });

    await attempt.save();

    // Log analytics event
    const event = new AnalyticsEvent({
      user_id,
      event_type: 'attempt_completed',
      activity: question.activity,
      level: question.level,
      question_no: question.question_no,
      data: {
        success,
        time_taken_seconds,
        hints_used,
        stars_earned
      },
      client_metadata
    });
    await event.save();

    // Update user state if successful
    if (success) {
      let userState = await UserState.findOne({ user_id });

      if (!userState) {
        userState = new UserState({ user_id });
      }

      // Update unlocked info
      const activityKey = question.activity;
      if (!userState.unlocked[activityKey]) {
        userState.unlocked[activityKey] = {
          level: question.level,
          highest_q_no: question.question_no
        };
      } else {
        userState.unlocked[activityKey].highest_q_no = Math.max(
          userState.unlocked[activityKey].highest_q_no,
          question.question_no
        );

        // Check if current level is completed
        // Get all questions for current level
        const levelQuestions = await ActivityQuestion.find({
          activity: question.activity,
          level: question.level
        });

        // Get all successful attempts for current level
        const successfulAttempts = await UserAttempt.find({
          user_id,
          activity: question.activity,
          level: question.level,
          success: true
        }).distinct('question_no');

        // If all questions in the level are completed, unlock next level
        if (levelQuestions.length > 0 && successfulAttempts.length >= levelQuestions.length) {
          userState.unlocked[activityKey].level = question.level + 1;
          userState.unlocked[activityKey].highest_q_no = 0; // Reset for next level
        }
      }

      userState.last_played = new Date();
      userState.updated_at = new Date();
      await userState.save();
    }

    res.status(201).json({
      success: true,
      message: success ? 'Attempt correct!' : 'Attempt incorrect',
      attempt,
      result: {
        success,
        stars_earned,
        correct_answer: success ? undefined : question.answer
      }
    });
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ message: 'Server error submitting attempt' });
  }
});

// Admin: Get user attempts with filters
router.get('/admin/attempts', async (req, res) => {
  try {
    const { user_id, activity, level, success } = req.query;
    const filter = {};

    if (user_id) filter.user_id = user_id;
    if (activity) filter.activity = activity;
    if (level) filter.level = parseInt(level);
    if (success !== undefined) filter.success = success === 'true';

    const attempts = await UserAttempt.find(filter).sort({ created_at: -1 }).limit(1000);

    // Calculate stats
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter(a => a.success).length;
    const averageTime = attempts.length > 0
      ? (attempts.reduce((sum, a) => sum + a.time_taken_seconds, 0) / attempts.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      attempts,
      stats: {
        total: totalAttempts,
        successful: successfulAttempts,
        successRate: totalAttempts > 0 ? ((successfulAttempts / totalAttempts) * 100).toFixed(2) + '%' : '0%',
        averageTime
      }
    });
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ message: 'Server error fetching attempts' });
  }
});

// Get user's attempt history
router.get('/attempts/:userId', async (req, res) => {
  try {
    const attempts = await UserAttempt.find({ user_id: req.params.userId })
      .sort({ created_at: -1 });

    res.json({
      success: true,
      attempts
    });
  } catch (error) {
    console.error('Get user attempts error:', error);
    res.status(500).json({ message: 'Server error fetching attempts' });
  }
});

// ==================== USER STATE ====================

// Get user's activity state
router.get('/state/:userId', async (req, res) => {
  try {
    let userState = await UserState.findOne({ user_id: req.params.userId });

    if (!userState) {
      userState = new UserState({ user_id: req.params.userId });
      await userState.save();
    }

    res.json({
      success: true,
      state: userState
    });
  } catch (error) {
    console.error('Get user state error:', error);
    res.status(500).json({ message: 'Server error fetching user state' });
  }
});

// Admin: Get all user states
router.get('/admin/states', async (req, res) => {
  try {
    const states = await UserState.find().sort({ last_played: -1 });

    res.json({
      success: true,
      count: states.length,
      states
    });
  } catch (error) {
    console.error('Get user states error:', error);
    res.status(500).json({ message: 'Server error fetching user states' });
  }
});

// ==================== ACTIVITY CONFIGS ====================

// Admin: Create activity config
router.post('/admin/configs', async (req, res) => {
  try {
    const configData = req.body;

    if (!configData.activity || !configData.display_name) {
      return res.status(400).json({ message: 'Missing required fields: activity, display_name' });
    }

    const config = new ActivityConfig(configData);
    await config.save();

    res.status(201).json({
      success: true,
      message: 'Activity config created successfully',
      config
    });
  } catch (error) {
    console.error('Create config error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Activity config already exists' });
    }
    res.status(500).json({ message: 'Server error creating config' });
  }
});

// Get activity config
router.get('/configs/:activity', async (req, res) => {
  try {
    const config = await ActivityConfig.findOne({ activity: req.params.activity });

    if (!config) {
      return res.status(404).json({ message: 'Activity config not found' });
    }

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ message: 'Server error fetching config' });
  }
});

// Admin: Get all activity configs
router.get('/admin/configs', async (req, res) => {
  try {
    const configs = await ActivityConfig.find();

    res.json({
      success: true,
      count: configs.length,
      configs
    });
  } catch (error) {
    console.error('Get configs error:', error);
    res.status(500).json({ message: 'Server error fetching configs' });
  }
});

// Admin: Update activity config
router.put('/admin/configs/:activity', async (req, res) => {
  try {
    const config = await ActivityConfig.findOneAndUpdate(
      { activity: req.params.activity },
      { ...req.body, updated_at: new Date() },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({ message: 'Activity config not found' });
    }

    res.json({
      success: true,
      message: 'Activity config updated successfully',
      config
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ message: 'Server error updating config' });
  }
});

// ==================== ANALYTICS ====================

// Admin: Get activity analytics
router.get('/admin/analytics', async (req, res) => {
  try {
    const { activity, days = 30 } = req.query;
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filter = { created_at: { $gte: daysAgo } };
    if (activity) filter.activity = activity;

    // Get events
    const events = await AnalyticsEvent.find(filter);

    // Get aggregated stats
    const stats = await AnalyticsEvent.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$event_type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get user engagement
    const userEngagement = await AnalyticsEvent.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$user_id',
          events: { $sum: 1 }
        }
      },
      { $sort: { events: -1 } }
    ]);

    // Get activity stats
    const activityStats = await UserAttempt.aggregate([
      { $match: { created_at: { $gte: daysAgo } } },
      {
        $group: {
          _id: '$activity',
          total_attempts: { $sum: 1 },
          successful_attempts: { $sum: { $cond: ['$success', 1, 0] } },
          total_time: { $sum: '$time_taken_seconds' },
          total_stars: { $sum: '$stars_earned' }
        }
      }
    ]);

    res.json({
      success: true,
      period: `Last ${days} days`,
      events: {
        total: events.length,
        breakdown: stats
      },
      userEngagement: {
        activeUsers: userEngagement.length,
        topUsers: userEngagement.slice(0, 10)
      },
      activityStats
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error fetching analytics' });
  }
});

// Admin: Get user detailed stats
router.get('/admin/user-stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const attempts = await UserAttempt.find({ user_id: userId });
    const events = await AnalyticsEvent.find({ user_id: userId });
    const state = await UserState.findOne({ user_id: userId });

    const stats = {
      total_attempts: attempts.length,
      successful_attempts: attempts.filter(a => a.success).length,
      success_rate: attempts.length > 0
        ? ((attempts.filter(a => a.success).length / attempts.length) * 100).toFixed(2) + '%'
        : '0%',
      total_stars: attempts.reduce((sum, a) => sum + a.stars_earned, 0),
      average_time: attempts.length > 0
        ? (attempts.reduce((sum, a) => sum + a.time_taken_seconds, 0) / attempts.length).toFixed(2) + 's'
        : '0s',
      total_events: events.length,
      activities_attempted: [...new Set(attempts.map(a => a.activity))],
      state
    };

    res.json({
      success: true,
      userId,
      stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error fetching user stats' });
  }
});

// Public: Get all activity configs (for user frontend)
router.get('/configs', async (req, res) => {
  try {
    const configs = await ActivityConfig.find().lean();

    res.json({
      success: true,
      count: configs.length,
      configs
    });
  } catch (error) {
    console.error('Get configs error:', error);
    res.status(500).json({ message: 'Server error fetching configs' });
  }
});

// User: Get levels for activity with user progress
router.get('/levels/:userId/:activity', async (req, res) => {
  try {
    const { userId, activity } = req.params;

    // Get all questions for this activity grouped by level
    const questions = await ActivityQuestion.find({ activity }).sort({ level: 1, question_no: 1 });

    if (questions.length === 0) {
      return res.status(404).json({ message: 'No questions found for this activity' });
    }

    // Get user's successful attempts for this activity
    const successfulAttempts = await UserAttempt.find({
      user_id: userId,
      activity,
      success: true
    });

    // Create a map of completed questions by level
    const completedByLevel = {};
    successfulAttempts.forEach(attempt => {
      const levelKey = attempt.level;
      if (!completedByLevel[levelKey]) {
        completedByLevel[levelKey] = new Set();
      }
      completedByLevel[levelKey].add(attempt.question_no);
    });

    // Group questions by level
    const levelMap = {};
    questions.forEach(q => {
      if (!levelMap[q.level]) {
        levelMap[q.level] = [];
      }
      levelMap[q.level].push(q);
    });

    // Get user state
    const userState = await UserState.findOne({ user_id: userId });
    const activityProgress = userState?.unlocked?.[activity] || { level: 1, highest_q_no: 0 };

    // Build levels array with completion status
    const levels = Object.keys(levelMap).sort((a, b) => parseInt(a) - parseInt(b)).map(level => {
      const levelNum = parseInt(level);
      const levelQuestions = levelMap[level];
      const totalQuestions = levelQuestions.length;
      const completedQuestions = completedByLevel[levelNum] ? completedByLevel[levelNum].size : 0;
      const isCompleted = completedQuestions === totalQuestions && totalQuestions > 0;

      // Determine difficulty based on level number
      let difficulty = 'easy';
      if (levelNum > 4) difficulty = 'hard';
      else if (levelNum > 2) difficulty = 'medium';

      return {
        level: levelNum,
        title: `Level ${levelNum}`,
        questions: totalQuestions,
        completedQuestions,
        isCompleted,
        difficulty,
        isUnlocked: true,
        isCurrent: levelNum === activityProgress.level
      };
    });

    res.json({
      success: true,
      levels,
      userProgress: {
        currentLevel: activityProgress.level,
        highestQuestionNo: activityProgress.highest_q_no,
        totalLevels: levels.length
      }
    });
  } catch (error) {
    console.error('Get levels with progress error:', error);
    res.status(500).json({ message: 'Server error fetching levels with progress' });
  }
});

// User: Get questions for activity/level with user progress
router.get('/questions/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { activity, level } = req.query;

    if (!activity || !level) {
      return res.status(400).json({ message: 'Missing required parameters: activity, level' });
    }

    // Get all questions for this activity and level
    const questions = await ActivityQuestion.find({
      activity,
      level: parseInt(level)
    }).sort({ question_no: 1 });

    if (questions.length === 0) {
      return res.status(404).json({ message: 'No questions found for this activity and level' });
    }

    // Get user's completed questions (successful attempts)
    const completedAttempts = await UserAttempt.find({
      user_id: userId,
      activity,
      level: parseInt(level),
      success: true
    }).distinct('question_no');

    // Get user state to find current progress
    const userState = await UserState.findOne({ user_id: userId });
    const activityProgress = userState?.unlocked?.[activity] || { level: 1, highest_q_no: 0 };

    // Find the next incomplete question
    let nextQuestionIndex = 0;
    for (let i = 0; i < questions.length; i++) {
      if (!completedAttempts.includes(questions[i].question_no)) {
        nextQuestionIndex = i;
        break;
      }
      // If we've gone through all and all are completed, stay at last question
      if (i === questions.length - 1) {
        nextQuestionIndex = questions.length - 1;
      }
    }

    // Transform questions to match frontend expectations
    const transformedQuestions = questions.map(q => ({
      _id: q._id,
      id: q.id,
      activity: q.activity,
      level: q.level,
      question_no: q.question_no,
      question_items: q.question_items,
      answer: q.answer,
      difficulty: q.difficulty,
      time_limit_seconds: q.time_limit_seconds,
      stars_for_perfect: q.stars_for_perfect,
      presentation: q.presentation,
      hints: q.hints,
      assets: q.assets,
      content_type: q.presentation?.display_type || 'drag_drop',
      question_text: q.question_text || `Level ${q.level} - Question ${q.question_no}`,
      image_url: q.image_url || '',
      match_pairs: q.match_pairs || [],
      options: q.question_items,
      version: q.version,
      locale: q.locale,
      completed: completedAttempts.includes(q.question_no)
    }));

    res.json({
      success: true,
      questions: transformedQuestions,
      nextQuestionIndex,
      progress: {
        completedQuestions: completedAttempts.length,
        totalQuestions: questions.length,
        currentLevel: activityProgress.level,
        highestQuestionNo: activityProgress.highest_q_no,
        completedQuestionNumbers: completedAttempts
      }
    });
  } catch (error) {
    console.error('Get questions with progress error:', error);
    res.status(500).json({ message: 'Server error fetching questions with progress' });
  }
});

module.exports = router;
