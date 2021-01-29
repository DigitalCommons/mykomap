const path = require('path');

module.exports = {
  entry: './www/map-app/app.js',
  mode: 'development',
  target: 'web',
  devtool: 'source-map',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
