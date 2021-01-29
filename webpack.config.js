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
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "static", to: buildDir },
      ],
    }),
  ],
};
