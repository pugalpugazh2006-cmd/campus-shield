try {
  const serverless = require('../dist/serverless.js');
  module.exports = serverless.default || serverless;
} catch (error) {
  module.exports = (req, res) => {
    res.status(500).json({
      message: 'Failed to load compiled NestJS app',
      error: error.message,
      stack: error.stack,
    });
  };
}
