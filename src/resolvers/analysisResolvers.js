const { requireAuth } = require('../middleware/auth');
const {
  performAnalysis,
  getUserAnalyses,
  getAnalysisById,
  getAnalysesByLanguage,
  deleteAnalysis,
  getDashboardStats,
} = require('../services/analysisService');
const { fixCode, fixCodeWithValidation } = require('../services/openaiService');

const analysisResolvers = {
  Query: {
    me: async (_, __, { user }) => {
      const authedUser = requireAuth(user);
      return {
        id: authedUser._id,
        username: authedUser.username,
        email: authedUser.email,
        analysisCount: authedUser.analysisCount,
        role: authedUser.role,
        createdAt: authedUser.createdAt.toISOString
          ? authedUser.createdAt.toISOString()
          : authedUser.createdAt,
      };
    },

    myAnalyses: async (_, { limit, offset }, { user }) => {
      const authedUser = requireAuth(user);
      const analyses = await getUserAnalyses(authedUser._id, limit, offset);
      return analyses.map(formatAnalysis);
    },

    analysis: async (_, { id }, { user }) => {
      const authedUser = requireAuth(user);
      const analysis = await getAnalysisById(id, authedUser._id);
      return formatAnalysis(analysis);
    },

    analysesByLanguage: async (_, { language }, { user }) => {
      const authedUser = requireAuth(user);
      const analyses = await getAnalysesByLanguage(authedUser._id, language);
      return analyses.map(formatAnalysis);
    },

    dashboardStats: async (_, __, { user }) => {
      const authedUser = requireAuth(user);
      return getDashboardStats(authedUser._id);
    },
  },

  Mutation: {
    analyzeCode: async (_, { title, language, sourceCode }, { user }) => {
      const authedUser = requireAuth(user);

      if (!sourceCode || sourceCode.trim().length === 0) {
        throw new Error('Source code cannot be empty');
      }

      if (sourceCode.length > 50000) {
        throw new Error('Source code exceeds maximum length of 50,000 characters');
      }

      const validLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp'];
      if (!validLanguages.includes(language)) {
        throw new Error(`Unsupported language: ${language}. Supported: ${validLanguages.join(', ')}`);
      }

      const analysis = await performAnalysis(authedUser._id, title, language, sourceCode);
      return formatAnalysis(analysis);
    },

    deleteAnalysis: async (_, { id }, { user }) => {
      const authedUser = requireAuth(user);
      return deleteAnalysis(id, authedUser._id);
    },

    fixCode: async (_, { analysisId }, { user }) => {
      const authedUser = requireAuth(user);
      const analysis = await getAnalysisById(analysisId, authedUser._id);
      if (!analysis) throw new Error('Analysis not found');
      if (!analysis.issues || analysis.issues.length === 0) {
        throw new Error('No issues to fix in this analysis');
      }
      // Production-grade: retries server-side until score ≥ 80 (max 3 attempts)
      return fixCodeWithValidation(analysis.sourceCode, analysis.language, analysis.issues);
    },
  },
};

function formatAnalysis(analysis) {
  return {
    id: analysis._id,
    title: analysis.title,
    language: analysis.language,
    sourceCode: analysis.sourceCode,
    issues: analysis.issues || [],
    metrics: analysis.metrics || {
      linesOfCode: 0,
      cyclomaticComplexity: 0,
      maintainabilityIndex: 0,
      duplicateRatio: 0,
      overallScore: 0,
    },
    summary: analysis.summary || '',
    status: analysis.status,
    processingTimeMs: analysis.processingTimeMs || 0,
    createdAt: analysis.createdAt?.toISOString
      ? analysis.createdAt.toISOString()
      : analysis.createdAt || '',
  };
}

module.exports = analysisResolvers;
