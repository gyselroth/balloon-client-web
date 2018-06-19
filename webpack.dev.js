const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  devtool: 'eval-source-map',
  devServer: {
    proxy: {
      '/api': {
        target: process.env.BALLOON_API_URL || 'https://localhost:8081',
        changeOrigin: true,
        secure: (process.env.BALLOON_API_URL_SECURE || 'false') === 'true'
      },
      '/share': {
        target: process.env.BALLOON_API_URL || 'https://localhost:8081',
        changeOrigin: true,
        secure: (process.env.BALLOON_API_URL_SECURE || 'false') === 'true'
      }
    }
  }
});
