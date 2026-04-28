require('dotenv').config();

const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const connectDB = require('../config/database');
const typeDefs = require('./resolvers/typeDefs');
const resolvers = require('./resolvers/index');
const { getUser } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 4000;

  await connectDB();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('combined'));
  app.use(apiLimiter);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'codescope',
      timestamp: new Date().toISOString(),
    });
  });

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (error) => {
      logger.error(`GraphQL Error: ${error.message}`);
      return {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
      };
    },
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    bodyParser.json({ limit: '5mb' }),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';
        const user = await getUser(token);
        return { user };
      },
    })
  );

  app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    logger.info(`CodeScope server running on http://localhost:${PORT}`);
    logger.info(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  logger.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
