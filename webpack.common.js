const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin');
const GitRevisionPlugin = require('git-revision-webpack-plugin');

var gitRevisionPlugin = new GitRevisionPlugin();

const extractSass = new ExtractTextPlugin({
  filename: "[name].[contenthash].css",
  disable: false
});

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    app: './main.js',
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
        test    : /\.(png|jpg|svg|gif|eot|woff|woff2|ttf)$/,
        loader  : 'url-loader?limit=30000&name=assets/[name].[ext]'
      },
      {
        test: /(\.jsx|\.js)$/,
        loader: 'eslint-loader',
        exclude: /node_modules/
      },
      {
        test: /\.scss$/,
        use: extractSass.extract({
          use: [{
            loader: "css-loader"
          }, {
            loader: "sass-loader"
          }],
          fallback: "style-loader"
        })
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
    }),
    new ExtractTextPlugin({
      filename: "balloon.css",
      allChunks: true
    }),
    extractSass,
    new HtmlWebpackPlugin({
      hash: true,
      filename: 'index.html',
      template: 'index.html',
      minify: {
        collapseWhitespace: true,
        preserveLineBreaks: false,
      }
    }),
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify(process.env.VERSION || gitRevisionPlugin.version()),
      'process.env.COMMITHASH': JSON.stringify(gitRevisionPlugin.commithash()),
      'process.env.BRANCH': JSON.stringify(gitRevisionPlugin.branch()),
    }),
    new MergeJsonWebpackPlugin({
      "output": {
        "groupBy": [
          {
            "pattern": "{./src/locale/en.json,./src/app/*/locale/en.json}",
            "fileName": "locale/en.json"
          },
          {
            "pattern": "{./src/locale/de.json,./src/app/*/locale/de.json}",
            "fileName": "locale/de.json"
          }
        ]
      },
      "globOptions": {
        "nosort": true
      }
    })
  ]
};
