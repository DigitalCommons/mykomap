const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

const buildDir = path.resolve(__dirname, 'dist');
module.exports = {
  entry: './www/map-app/app/main.js',
  mode: 'development',
  target: 'web',
  devtool: 'source-map',
  output: {
    filename: 'main.js',
    path: buildDir,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              import: true,
            },
          },
        ],
      },
      {
        test: /\.png$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'images/',
            },
          },
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/',
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "static", to: buildDir }, // FIXME exclude *~
      ],
    }),
  ],
};
