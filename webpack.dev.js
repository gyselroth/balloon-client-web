const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  devtool: 'eval-source-map',
  devServer: {
    proxy: {
      '/api': {
        target: 'https://localhost:8081',
        secure: false,
        //changeOrigin: true
      }
    }
  }
});
