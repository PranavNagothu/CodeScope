require('dotenv').config();
const mongoose = require('mongoose');
const KnowledgeBase = require('../models/KnowledgeBase');
const { indexAllDocuments } = require('../services/ragService');
const logger = require('./logger');

const seedData = [
  {
    category: 'security',
    language: 'general',
    title: 'SQL Injection Prevention',
    content: 'Never concatenate user input directly into SQL queries. Use parameterized queries or prepared statements. ORMs like Mongoose, Sequelize, or Prisma provide built-in protection against SQL injection attacks.',
    tags: ['sql', 'injection', 'database', 'input-validation'],
    source: 'OWASP Top 10',
  },
  {
    category: 'security',
    language: 'javascript',
    title: 'Cross-Site Scripting (XSS) Prevention',
    content: 'Always sanitize and escape user-generated content before rendering it in HTML. Use libraries like DOMPurify for client-side sanitization. Set Content-Security-Policy headers to restrict script sources.',
    tags: ['xss', 'sanitization', 'html', 'security-headers'],
    source: 'OWASP Top 10',
  },
  {
    category: 'best-practices',
    language: 'javascript',
    title: 'Error Handling Best Practices',
    content: 'Always use try-catch blocks for async operations. Never swallow errors silently. Create custom error classes for different error types. Log errors with sufficient context for debugging. Use error boundaries in React applications.',
    tags: ['error-handling', 'try-catch', 'async', 'debugging'],
    source: 'Node.js Best Practices',
  },
  {
    category: 'performance',
    language: 'javascript',
    title: 'Avoiding Memory Leaks',
    content: 'Remove event listeners when components unmount. Clear intervals and timeouts. Avoid storing large objects in closures. Use WeakMap and WeakSet for caching references. Monitor heap usage in production with --inspect flag.',
    tags: ['memory-leak', 'performance', 'garbage-collection', 'closures'],
    source: 'Node.js Performance Guide',
  },
  {
    category: 'anti-patterns',
    language: 'javascript',
    title: 'Callback Hell and Promise Anti-Patterns',
    content: 'Avoid deeply nested callbacks by using async/await. Do not mix callbacks and promises in the same function. Always handle promise rejections. Avoid creating unnecessary promise wrappers around callback-based APIs when util.promisify is available.',
    tags: ['callbacks', 'promises', 'async-await', 'anti-pattern'],
    source: 'JavaScript Design Patterns',
  },
  {
    category: 'security',
    language: 'python',
    title: 'Input Validation and Sanitization',
    content: 'Validate all user inputs using schemas (Pydantic, marshmallow). Never use eval() or exec() with user input. Use parameterized queries with database drivers. Sanitize file paths to prevent directory traversal attacks.',
    tags: ['input-validation', 'eval', 'parameterized-queries', 'path-traversal'],
    source: 'Python Security Best Practices',
  },
  {
    category: 'best-practices',
    language: 'python',
    title: 'Python Code Organization',
    content: 'Follow PEP 8 style guide. Use type hints for function parameters and return values. Organize imports with isort. Keep functions under 20 lines. Use dataclasses or Pydantic models for structured data. Write docstrings for public functions.',
    tags: ['pep8', 'type-hints', 'code-style', 'organization'],
    source: 'PEP 8 Style Guide',
  },
  {
    category: 'performance',
    language: 'java',
    title: 'Java Performance Optimization',
    content: 'Use StringBuilder for string concatenation in loops. Prefer ArrayList over LinkedList for most use cases. Use connection pooling for database connections. Avoid creating unnecessary objects. Use streams judiciously as they add overhead for small collections.',
    tags: ['string-builder', 'collections', 'connection-pooling', 'streams'],
    source: 'Effective Java',
  },
  {
    category: 'design-patterns',
    language: 'general',
    title: 'SOLID Principles',
    content: 'Single Responsibility: each class should have one reason to change. Open/Closed: open for extension, closed for modification. Liskov Substitution: subtypes must be substitutable for base types. Interface Segregation: prefer small, specific interfaces. Dependency Inversion: depend on abstractions, not concretions.',
    tags: ['solid', 'design-principles', 'oop', 'architecture'],
    source: 'Clean Architecture by Robert C. Martin',
  },
  {
    category: 'best-practices',
    language: 'go',
    title: 'Go Error Handling',
    content: 'Always check returned errors. Use error wrapping with fmt.Errorf and %w verb. Create sentinel errors for expected error conditions. Use custom error types for errors that carry additional context. Never ignore errors from Close() calls on resources.',
    tags: ['error-handling', 'error-wrapping', 'sentinel-errors', 'go-idioms'],
    source: 'Effective Go',
  },
  {
    category: 'security',
    language: 'general',
    title: 'Authentication Best Practices',
    content: 'Hash passwords with bcrypt (cost factor 12+). Use JWT with short expiry times and refresh tokens. Implement rate limiting on login endpoints. Never store plaintext passwords. Use HTTPS for all authentication endpoints. Implement account lockout after failed attempts.',
    tags: ['authentication', 'bcrypt', 'jwt', 'rate-limiting', 'passwords'],
    source: 'OWASP Authentication Cheat Sheet',
  },
  {
    category: 'performance',
    language: 'general',
    title: 'Database Query Optimization',
    content: 'Create indexes for frequently queried fields. Use compound indexes for multi-field queries. Avoid N+1 query problems by using eager loading or batch queries. Use EXPLAIN to analyze query plans. Implement connection pooling. Cache frequently accessed data.',
    tags: ['database', 'indexing', 'n-plus-1', 'query-optimization', 'caching'],
    source: 'Database Performance Guide',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    const existing = await KnowledgeBase.countDocuments();
    if (existing > 0) {
      logger.info(`Knowledge base already has ${existing} entries. Skipping seed.`);
      process.exit(0);
    }

    await KnowledgeBase.insertMany(seedData);
    logger.info(`Seeded ${seedData.length} knowledge base entries`);

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      logger.info('Generating embeddings for knowledge base entries...');
      await indexAllDocuments();
    } else {
      logger.warn('OPENAI_API_KEY not set. Skipping embedding generation. RAG will not work until embeddings are generated.');
    }

    logger.info('Seeding complete');
    process.exit(0);
  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`);
    process.exit(1);
  }
}

seed();
