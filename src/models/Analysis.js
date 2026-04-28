const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['bug', 'security', 'performance', 'style', 'maintainability', 'complexity'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    required: true,
  },
  line: {
    type: Number,
    default: null,
  },
  message: {
    type: String,
    required: true,
  },
  suggestion: {
    type: String,
    default: '',
  },
});

const metricsSchema = new mongoose.Schema({
  linesOfCode: { type: Number, default: 0 },
  cyclomaticComplexity: { type: Number, default: 0 },
  maintainabilityIndex: { type: Number, default: 0 },
  duplicateRatio: { type: Number, default: 0 },
  overallScore: { type: Number, min: 0, max: 100, default: 0 },
});

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      required: true,
      enum: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp'],
    },
    sourceCode: {
      type: String,
      required: true,
      maxlength: 50000,
    },
    issues: [issueSchema],
    metrics: metricsSchema,
    summary: {
      type: String,
      default: '',
    },
    ragContext: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    processingTimeMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ language: 1, 'metrics.overallScore': -1 });

module.exports = mongoose.model('Analysis', analysisSchema);
