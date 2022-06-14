// Karma configuration
// Generated on Fri Sep 10 2021 12:07:37 GMT+0100 (British Summer Time)
'use strict';

// webpack config for mocha tests
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['mocha', 'chai', 'webpack'],


    // list of files / patterns to load in the browser
    files: [
      'test/browser-test-all.js',
    ],


    // list of files / patterns to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
    preprocessors: {
      // add webpack as preprocessor
      //'test/test-test.js': [ 'webpack' ],
      'test/**/*.js': [ 'webpack', 'sourcemap' ],
      //'www/map-app/**/*.js': [ 'webpack' ],
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    browsers: ['ChromeHeadless', 'Firefox'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity,

    customLaunchers: {
      FirefoxHeadless: {
        base: 'Firefox',
        flags: ['-headless'],
      },
    },
    
    webpack: {
      //  context: __dirname,
      devtool: 'inline-source-map',
      mode: 'development',
      //target: 'node',
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
          './view/map/popup$':  `${__dirname}/www/map-app/app/view/map/default_popup.js`,
          // Define this alias so that it works as before in popup.js
          'model/dataservices$': `${__dirname}/www/map-app/app/model/dataservices.ts`,
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
    },
  })
}
