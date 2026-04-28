# CodeScope — AI-Powered Code Analysis Platform

![Tests](https://img.shields.io/badge/tests-28%20passing-brightgreen) ![Node](https://img.shields.io/badge/node-22.x-green) ![License](https://img.shields.io/badge/license-MIT-blue)

An intelligent code analysis platform that leverages OpenAI's GPT-4o-mini with Retrieval-Augmented Generation (RAG) to provide deep, context-aware code reviews. Built with Node.js, Express, GraphQL, and MongoDB.

## Features

- **AI-Powered Analysis** — Detects bugs, security vulnerabilities, performance issues, style violations, and complexity problems using OpenAI GPT-4o-mini
- **RAG Pipeline** — Enhances analysis accuracy by retrieving relevant coding best practices from a curated knowledge base using vector embeddings and cosine similarity
- **GraphQL API** — Flexible query interface for submitting code, retrieving analysis history, and viewing dashboard statistics
- **JWT Authentication** — Secure user registration and login with bcrypt password hashing
- **Analysis History** — Query past analyses by language, date, or quality score
- **Dashboard Stats** — Aggregated metrics: total analyses, average scores, top issue types, language breakdown
- **Rate Limiting** — Prevents API abuse with configurable request limits
- **Dockerized** — Full Docker Compose setup with MongoDB for one-command deployment

## Architecture

```
Client (GraphQL queries/mutations)
    ↓
Express.js Server (middleware: CORS, Helmet, rate limiting, JWT auth)
    ↓
Apollo Server (GraphQL resolvers)
    ↓
┌──────────────────────────────────────────┐
│  Analysis Service (orchestrator)         │
│    ├── RAG Service                       │
│    │     ├── Generate embedding (OpenAI) │
│    │     ├── Search KnowledgeBase        │
│    │     └── Return top-K context        │
│    ├── OpenAI Service                    │
│    │     ├── System prompt + RAG context │
│    │     └── Return issues + metrics     │
│    └── Save results to MongoDB           │
└──────────────────────────────────────────┘
    ↓
MongoDB (Users, Analyses, KnowledgeBase)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| API | GraphQL (Apollo Server) |
| Database | MongoDB (Mongoose) |
| AI | OpenAI API (GPT-4o-mini) |
| Embeddings | OpenAI text-embedding-3-small |
| Auth | JWT + bcrypt |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Winston |
| Testing | Jest + Supertest |
| Containerization | Docker + Docker Compose |

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 7+ (or use Docker)
- OpenAI API key

### Quick Start with Docker (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/PranavNagothu/CodeScope.git
cd CodeScope

# 2. Set environment variables
cp .env.example .env
# Edit .env — set OPENAI_API_KEY and JWT_SECRET

# 3. Start services
docker compose up -d

# 4. Seed the knowledge base (required for RAG)
docker compose exec app node src/utils/seed.js

# 5. Verify
curl http://localhost:4000/health
# → {"status":"healthy","service":"codescope",...}

# 6. GraphQL playground → http://localhost:4000/graphql
```

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env

# Start MongoDB
docker run -d -p 27017:27017 --name codescope-mongo mongo:7

# Seed knowledge base (generates embeddings — requires OpenAI key)
npm run seed

# Start dev server with hot reload
npm run dev

# Run tests
npm test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `4000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key (GPT-4o-mini + embeddings) |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `JWT_EXPIRY` | No | Token expiry (default: `7d`) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default: `900000`) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default: `100`) |

## GraphQL API

### Mutations

**Register:**
```graphql
mutation {
  register(username: "pranav", email: "pranav@example.com", password: "securepass123") {
    token
    user { id username email }
  }
}
```

**Login:**
```graphql
mutation {
  login(email: "pranav@example.com", password: "securepass123") {
    token
    user { id username }
  }
}
```

**Analyze Code:**
```graphql
mutation {
  analyzeCode(
    title: "Login Controller"
    language: "javascript"
    sourceCode: "function login(user, pass) { db.query('SELECT * FROM users WHERE name=' + user); }"
  ) {
    id
    issues { type severity line message suggestion }
    metrics { overallScore cyclomaticComplexity }
    summary
    processingTimeMs
  }
}
```

### Queries

**Analysis History:**
```graphql
query {
  myAnalyses(limit: 10) {
    id title language
    metrics { overallScore }
    createdAt
  }
}
```

**Dashboard:**
```graphql
query {
  dashboardStats {
    totalAnalyses
    averageScore
    topIssueTypes { type count }
    languageBreakdown { language count }
  }
}
```

## RAG Pipeline

The RAG (Retrieval-Augmented Generation) pipeline enhances code analysis by providing relevant context from a curated knowledge base:

1. **Embedding Generation** — Source code is converted to a 1536-dimensional vector using OpenAI's `text-embedding-3-small` model
2. **Similarity Search** — The embedding is compared against knowledge base entries using cosine similarity
3. **Context Retrieval** — Top 5 most relevant best practices (above 0.3 similarity threshold) are retrieved
4. **Augmented Analysis** — Retrieved context is injected into the OpenAI prompt, improving analysis accuracy by providing language-specific best practices

The knowledge base contains entries covering:
- Security best practices (OWASP Top 10)
- Performance optimization patterns
- Common anti-patterns
- Design principles (SOLID)
- Language-specific idioms

## Testing

```bash
# Run all tests with coverage
npm test
```

**Test suites:** 3 | **Tests:** 28 | **All passing** ✅

| Suite | What it tests |
|-------|---------------|
| `auth.test.js` | JWT generation, token verification, expiry, bcrypt hashing |
| `rag.test.js` | Cosine similarity math, document ranking, top-K filtering, 1536-dim vectors |
| `analysis.test.js` | Input validation, language allow-list, result field structure |

> Coverage is intentionally focused on logic units (auth, RAG math) rather than integration layers, which are tested via Docker end-to-end.

## Deployment Notes

### Seeding the Knowledge Base

The RAG pipeline requires embeddings pre-generated in MongoDB. Run once after first deploy:

```bash
# With Docker
docker compose exec app node src/utils/seed.js

# Local
OPENAI_API_KEY=sk-... npm run seed
```

This inserts 12 knowledge base entries covering OWASP Top 10, SOLID principles, and language-specific best practices, then generates 1536-dim embeddings via `text-embedding-3-small`.

### Health Check

```bash
curl http://localhost:4000/health
# {"status":"healthy","service":"codescope","timestamp":"2026-04-26T..."}
```

### Rate Limits

- **API:** 100 requests per 15 minutes per IP
- **Analysis:** 30 analysis requests per hour per IP

## Project Structure

```
codescope/
├── config/
│   └── database.js
├── src/
│   ├── index.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Analysis.js
│   │   └── KnowledgeBase.js
│   ├── resolvers/
│   │   ├── index.js
│   │   ├── typeDefs.js
│   │   ├── authResolvers.js
│   │   └── analysisResolvers.js
│   ├── services/
│   │   ├── openaiService.js
│   │   ├── ragService.js
│   │   └── analysisService.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── rateLimiter.js
│   └── utils/
│       ├── logger.js
│       └── seed.js
├── tests/
│   ├── auth.test.js
│   ├── analysis.test.js
│   └── rag.test.js
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Supported Languages

JavaScript, TypeScript, Python, Java, Go, Rust, C++

## License

MIT
