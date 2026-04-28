const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ['best-practices', 'anti-patterns', 'security', 'performance', 'design-patterns'],
      index: true,
    },
    language: {
      type: String,
      required: true,
      enum: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'general'],
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    tags: [String],
    source: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

knowledgeBaseSchema.index({ category: 1, language: 1 });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
