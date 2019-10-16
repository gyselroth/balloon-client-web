const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  devtool: 'eval-source-map',
  devServer: {
    //https: true,
    //public: 'webpack:8080',
    proxy: {
      '/api': {
        target: process.env.BALLOON_API_URL || 'http://localhost:8084',
        changeOrigin: true,
        secure: (process.env.BALLOON_API_URL_SECURE || 'false') === 'true'
      },
      '/share': {
        target: process.env.BALLOON_API_URL || 'http://localhost:8084',
        changeOrigin: true,
        secure: (process.env.BALLOON_API_URL_SECURE || 'false') === 'true'
      }
    }
  }
});
