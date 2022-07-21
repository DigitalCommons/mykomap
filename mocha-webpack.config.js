'use strict';

// webpack config for mocha tests
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
//  context: __dirname,
  entry: 'www/map-app/app.js', // path.join will strip leading '.'
  devtool: 'source-map',
  mode: 'development',
  target: 'node',
  /*output: {
    path: destPath,
    filename: 'map-app/map-app.js',
  },*/
  module: {
    rules: [
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },
      {
        test: /\.css$/,
        use: [
          { // extracts the css into a single output file for
            // index.html to include statically.
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../', // undo the effect of loading images/fonts inside map-app
            },
          },
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
              outputPath: 'map-app/images/',
              publicPath: 'images',
            },
          },
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'map-app/fonts/[name]-[hash][ext][query]',
        },
      },
      {
        test: /\.php$/,
        type: 'asset/resource',
        generator: {
          filename: 'services/[name][ext][query]',
        },
      }
    ],
  },
  resolve: {
    alias: {
      // Allows loading modules in the test directory
      'test': `${__dirname}/test`,
      // Allows custom popup logic to be supplied config/popup.js (if detected)
      './view/map/popup$':  'www/map-app/app/view/map/default_popup.js',
      // Define this alias so that it works as before in popup.js
      'model/dataservices$': 'www/map-app/app/model/dataservices.ts',
    },
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'map-app/map-app.css',
    }),
    new CopyPlugin({
      patterns: [
//        { from: configPath, to: 'configuration',
//          globOptions: { ignore: ['**/*~'] },
//        },
        { context: 'www/services', from: '**/*.php', to: 'services' },
//        ...copyPaths.map(p => {
//          let { dir, base } = path.parse(p);
//          if (!fs.statSync(p).isFile())
//            base += '/**';
//          console.log(`copying: ${dir}/${base}`);
//          return { from: base, to: '.', context: dir,
//                   globOptions: { ignore: ['**/*~'] } }
//        })
      ],
    }),
  ],
};
