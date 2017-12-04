const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin');
const GitRevisionPlugin = require('git-revision-webpack-plugin')

var gitRevisionPlugin = new GitRevisionPlugin();

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    app: './app.js',
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'balloon.bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: "css-loader"
        })
      },
      {
        test    : /\.(png|jpg|svg|gif|eot|woff|woff2|ttf)$/,
        loader  : 'url-loader?limit=30000&name=assets/[name].[ext]'
      },
      /*{
        test: /(\.jsx|\.js)$/,
        loader: 'eslint-loader',
        exclude: /node_modules/
      },*/
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery"
    }),
    new ExtractTextPlugin({
      filename: "balloon.css",
      allChunks: true
    }),
    new HtmlWebpackPlugin({
      hash: true,
      filename: 'index.html',
      template: 'index.html',
    }),
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify(gitRevisionPlugin.version()),
      'process.env.COMMITHASH': JSON.stringify(gitRevisionPlugin.commithash()),
      'process.env.BRANCH': JSON.stringify(gitRevisionPlugin.branch()),
    }),
    new MergeJsonWebpackPlugin({
      "output": {
          "groupBy": [
              {
                 "pattern": "{./src/locale/en.json,./src/app/*/locale/en.json}",
                 "fileName": "locale/en.json"
              }
          ]
      },
      "globOptions": {
          "nosort": true
      }
    })
  ]
};
