#!/usr/bin/env node

/**
 * Emulates the older RequireJS script sea-site-build, but invokes webpack
 * and builds using commonJS modules.
 *
 */
const fs = require('fs');
const minimist = require('minimist');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const spawn = require('child_process').spawnSync;
const cwd = process.cwd();

function die(msg) {
  console.error(msg);
  process.exit(-1);
}

const args = minimist(process.argv.slice(2), {
  string: ['c', 'd', 'm'],
});

const configPath = path.resolve(
  cwd, args.c || die("you must supply a path to the config files -c")
);
const seaMapPath = path.resolve(
  cwd, args.m || die("you must supply a path to the sea-map module in -m")
);
const destPath = path.resolve(
  cwd, args.d || die("you must supply a path to the build destination in -d"), 'out'
);
const copyPaths = args
  ._
  .filter( p => !p.match('~$'))
  .map(p => path.resolve(cwd, p))

const exec = (str, cwd) => {
  const [ cmd, ...args ] = str.split(/ +/)
  const options = cwd? { cwd } : undefined;
  return spawn(cmd, args, options);
}
const shell = (str, cwd) => {
  const result = exec(str, cwd);
  if (result.status == 0)
    return String(result.stdout).replace(/\n$/, '');
  
  console.error(`command failed: ${str}`);
  process.exit(1)
}
const timestamp = new Date().toISOString();

function getGitCommit(cwd) {
  var commit = shell(`git rev-parse --short HEAD`, cwd);

  if (exec(`git diff-index --quiet HEAD`, cwd).status)
	  commit += "-modified";
  return commit;
}

// This resolves to sea-map's package.json.
const seaMapPackageJson = require(path.join(seaMapPath, 'package.json'));
const variant = process.env.npm_package_name;

const debug = variant == 'sea-map' || process.env.NODE_ENV !== "production";

const versionJson = path.join(configPath, 'version.json');
let versionInfo;
let srcDir;
let entry;
if (variant == 'sea-map') {
  // Infer development mode from sea-map package

  entry = "./www/map-app/app.js";
  srcDir = "./www/map-app"; // locally
  
  // Get the linked dependency config in ext/package.json 
  const mapPackageJson = require(path.join(cwd, 'ext/package.json'));
  versionInfo = {
	  variant: mapPackageJson.name,
	  timestamp: timestamp,
	  gitcommit: getGitCommit(path.join(cwd, '/ext')),
	  seaMapVersion: seaMapPackageJson.version+'_'+getGitCommit()+'-dev',
	  seaMapResolvedVersion: seaMapPackageJson._resolved, // may be undefined
  };
}
else {
  // Infer production mode

  entry = "sea-map/www/map-app/app.js";
  srcDir = "./node_modules/sea-map/www/map-app"; // in the sea-map module dep
  
  // Get the sea-map git commit ID from the resolved version (we don't have
  // access to the git repo in this case).
  const seaMapResolved = (seaMapPackageJson._resolved || '');
  const seaMapCommit = seaMapResolved.replace(/^.*#/, '_').substr(0, 8);
  versionInfo = {
	  variant: variant,
	  timestamp: timestamp,
	  gitcommit: getGitCommit(),
	  seaMapVersion: seaMapPackageJson.version+seaMapCommit,
	  seaMapResolvedVersion: seaMapPackageJson._resolved, // may be undefined
  };
}
fs.writeFileSync(versionJson,
                 JSON.stringify(versionInfo, null, 2));

const customPopupModulePath = path.join(configPath, 'popup.js');
const defaultPopupModulePath = path.join(srcDir, 'app/view/map/default_popup.js');
const popupModulePath = fs.existsSync(customPopupModulePath) ?
                        customPopupModulePath : defaultPopupModulePath;
console.log("popup.js:", popupModulePath);

const webpackConfig = {
  context: cwd,
  entry: srcDir+"/app.js", // path.join will strip leading '.'
  devtool: debug ? "source-map" : false,
  mode: debug? 'development' : 'production',
  target: 'web',
  output: {
    path: destPath,
    filename: "map-app/map-app.js",
  },
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
      },
    ],
  },
  resolve: {
    alias: {
      // Allows custom popup logic to be supplied config/popup.js (if detected)
      "./view/map/popup$":  popupModulePath,
      // Define this alias so that it works as before in popup.js
      "model/sse_initiative$": path.resolve(srcDir, "app/model/sse_initiative.js"),
    },
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'map-app/map-app.css',
    }),
	  new CopyPlugin({
	    patterns: [
		    { from: configPath, to: "configuration",
		      globOptions: { ignore: ["**/*~"] },
		    },
		    ...copyPaths.map(p => {
	        let { dir, base } = path.parse(p);
          if (!fs.statSync(p).isFile())
            base += '/**';
          console.log(`copying: ${dir}/${base}`);
	        return { from: base, to: ".", context: dir,
                   globOptions: { ignore: ["**/*~"] } }
	      })
      ],
    }),
  ],
};

webpack(
  webpackConfig,
  (err, stats) => {
	  if (err || stats.hasErrors()) {
	    die(`webpack error: ${stats}`);
    }
    else
      console.log(`webpack: ${stats}`);
  }
);
