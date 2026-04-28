const authResolvers = require('./authResolvers');
const analysisResolvers = require('./analysisResolvers');

const resolvers = {
  Query: {
    ...analysisResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...analysisResolvers.Mutation,
  },
};

module.exports = resolvers;
