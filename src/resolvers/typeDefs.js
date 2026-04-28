const typeDefs = `#graphql
  type User {
    id: ID!
    username: String!
    email: String!
    analysisCount: Int!
    role: String!
    createdAt: String!
  }

  type Issue {
    type: String!
    severity: String!
    line: Int
    message: String!
    suggestion: String
  }

  type Metrics {
    linesOfCode: Int!
    cyclomaticComplexity: Int!
    maintainabilityIndex: Int!
    duplicateRatio: Float!
    overallScore: Int!
  }

  type Analysis {
    id: ID!
    title: String!
    language: String!
    sourceCode: String!
    issues: [Issue!]!
    metrics: Metrics!
    summary: String!
    status: String!
    processingTimeMs: Int!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type IssueCount {
    type: String!
    count: Int!
  }

  type LanguageCount {
    language: String!
    count: Int!
  }

  type DashboardStats {
    totalAnalyses: Int!
    averageScore: Float!
    topIssueTypes: [IssueCount!]!
    languageBreakdown: [LanguageCount!]!
  }

  type FixResult {
    fixedCode: String!
    summary: String!
    processingTimeMs: Int!
  }

  type Query {
    me: User!
    myAnalyses(limit: Int, offset: Int): [Analysis!]!
    analysis(id: ID!): Analysis!
    analysesByLanguage(language: String!): [Analysis!]!
    dashboardStats: DashboardStats!
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    analyzeCode(title: String!, language: String!, sourceCode: String!): Analysis!
    fixCode(analysisId: ID!): FixResult!
    deleteAnalysis(id: ID!): Boolean!
  }
`;

module.exports = typeDefs;
