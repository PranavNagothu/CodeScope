const mongoose = require('mongoose');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const { analyzeCode } = require('./openaiService');
const { retrieveContext } = require('./ragService');
const logger = require('../utils/logger');

// The LLM sometimes returns issue types that don't match our schema enum.
// This maps those to the closest valid value instead of letting Mongoose throw.
const VALID_TYPES = ['bug', 'security', 'performance', 'style', 'maintainability', 'complexity'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

const TYPE_KEYWORDS = {
  security:        ['security', 'injection', 'xss', 'auth', 'encrypt', 'secret', 'credential', 'vulnerability'],
  bug:             ['bug', 'error', 'null', 'undefined', 'exception', 'crash', 'handling', 'leak', 'resource'],
  performance:     ['performance', 'slow', 'memory', 'cache', 'optim', 'loop', 'inefficient'],
  style:           ['style', 'naming', 'format', 'convention', 'readability', 'indent'],
  complexity:      ['complexity', 'complex', 'cyclomatic', 'nested', 'coupling'],
  maintainability: ['maintainability', 'maintain', 'solid', 'responsibility', 'modular', 'document', 'comment', 'docstring'],
};

function sanitizeIssues(issues = []) {
  return issues.map(issue => {
    const rawType = (issue.type || '').toLowerCase().replace(/[^a-z ]/g, '');
    const rawSeverity = (issue.severity || '').toLowerCase();

    const validType = VALID_TYPES.includes(rawType)
      ? rawType
      : VALID_TYPES.find(t => TYPE_KEYWORDS[t]?.some(kw => rawType.includes(kw))) || 'maintainability';

    const validSeverity = VALID_SEVERITIES.includes(rawSeverity) ? rawSeverity : 'medium';

    return { ...issue, type: validType, severity: validSeverity };
  });
}

// We don't trust the model's self-reported score — it tends to be conservative
// and inconsistent. This computes score from the actual issues instead.
function computeScore(issues = []) {
  const PENALTIES = { critical: 20, high: 12, medium: 4, low: 1, info: 0 };
  const deduction = issues.reduce((sum, issue) => sum + (PENALTIES[issue.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - deduction));
}

async function performAnalysis(userId, title, language, sourceCode) {
  const analysis = await Analysis.create({
    userId,
    title,
    language,
    sourceCode,
    status: 'processing',
  });

  try {
    const ragContext = await retrieveContext(sourceCode, language);
    analysis.ragContext = ragContext;

    const result = await analyzeCode(sourceCode, language, ragContext);

    analysis.issues = sanitizeIssues(result.issues || []);
    analysis.metrics = {
      ...(result.metrics || {}),
      overallScore: computeScore(analysis.issues),
    };
    analysis.summary = result.summary || '';
    analysis.processingTimeMs = result.processingTimeMs;
    analysis.status = 'completed';

    await analysis.save();
    await User.findByIdAndUpdate(userId, { $inc: { analysisCount: 1 } });

    logger.info(`Analysis completed for user ${userId}: ${title} (${language})`);
    return analysis;
  } catch (error) {
    analysis.status = 'failed';
    await analysis.save();
    logger.error(`Analysis failed for user ${userId}: ${error.message}`);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

async function getUserAnalyses(userId, limit = 20, offset = 0) {
  return Analysis.find({ userId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
}

async function getAnalysisById(analysisId, userId) {
  const analysis = await Analysis.findOne({ _id: analysisId, userId }).lean();
  if (!analysis) {
    throw new Error('Analysis not found or access denied');
  }
  return analysis;
}

async function getAnalysesByLanguage(userId, language) {
  return Analysis.find({ userId, language })
    .sort({ createdAt: -1 })
    .lean();
}

async function deleteAnalysis(analysisId, userId) {
  const result = await Analysis.findOneAndDelete({ _id: analysisId, userId });
  if (!result) {
    throw new Error('Analysis not found or access denied');
  }
  await User.findByIdAndUpdate(userId, { $inc: { analysisCount: -1 } });
  logger.info(`Analysis deleted: ${analysisId}`);
  return true;
}

async function getDashboardStats(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const totalAnalyses = await Analysis.countDocuments({ userId, status: 'completed' });

  const avgScoreResult = await Analysis.aggregate([
    { $match: { userId: userObjectId, status: 'completed' } },
    { $group: { _id: null, avgScore: { $avg: '$metrics.overallScore' } } },
  ]);

  const topIssueTypes = await Analysis.aggregate([
    { $match: { userId: userObjectId, status: 'completed' } },
    { $unwind: '$issues' },
    { $group: { _id: '$issues.type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  const languageBreakdown = await Analysis.aggregate([
    { $match: { userId: userObjectId, status: 'completed' } },
    { $group: { _id: '$language', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    totalAnalyses,
    averageScore: avgScoreResult[0]?.avgScore || 0,
    topIssueTypes: topIssueTypes.map(t => ({ type: t._id, count: t.count })),
    languageBreakdown: languageBreakdown.map(l => ({ language: l._id, count: l.count })),
  };
}

module.exports = {
  performAnalysis,
  getUserAnalyses,
  getAnalysisById,
  getAnalysesByLanguage,
  deleteAnalysis,
  getDashboardStats,
};
