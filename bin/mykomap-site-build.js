#!/usr/bin/env node

/**
 * Emulates the older RequireJS script sea-site-build, but invokes webpack
 * and builds using commonJS modules.
 *
 * a file `src/config.ts` is defined in the project using this which exports a `config` value
 * that when converted to JSON can be used as the config.json file used by
 * Shipshape and other monitoring tools.
 */
const fs = require('fs');
const minimist = require('minimist');
const os = require('os');
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
  string: ['c', 'd', 'm', 's'],
});

const configPath = path.resolve(
  cwd, args.c || die("you must supply a path to the config files -c")
);
const srcPath = args.s? path.resolve(cwd, args.s) : undefined;
const mykoMapPath = path.resolve(
  cwd, args.m || die("you must supply a path to the mykomap module in -m")
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

// This resolves to mykomap's package.json.
const mykoMapPackageJson = require(path.join(mykoMapPath, 'package.json'));
const variant = process.env.npm_package_name;

const debug = variant == 'mykomap' || process.env.NODE_ENV !== "production";

const versionJson = srcPath? path.join(srcPath, 'version.json') : path.resolve(cwd, 'src/version.json');
const mapConfigModule = srcPath? path.join(srcPath, 'config.ts') : path.resolve(cwd, 'src/config.ts');
const configJson = path.join(configPath, 'config.json');
let versionInfo;
let tsConfigFile;
let mykoMapSrcDir;
let servicesDir;
let entry;
if (variant == 'mykomap') {
  // Infer development mode from mykomap package

  mykoMapSrcDir = "./src/map-app"; // locally
  servicesDir = "./src/services";
  tsConfigFile = path.resolve(cwd, "ext/tsconfig.json");
  
  // Get the linked dependency config in ext/package.json 
  const mapPackageJson = require(path.join(cwd, 'ext/package.json'));
  versionInfo = {
    variant: mapPackageJson.name,
    timestamp: timestamp,
    gitcommit: getGitCommit(path.join(cwd, '/ext')),
    mykoMapVersion: mykoMapPackageJson.version+'_'+getGitCommit()+'-dev',
    mykoMapResolvedVersion: mykoMapPackageJson._resolved, // may be undefined
  };
}
else {
  // Infer production mode

  mykoMapSrcDir = "./node_modules/mykomap/src/map-app"; // in the mykomap module dep
  servicesDir = "./node_modules/mykomap/src/services"; // in the mykomap module dep
  tsConfigFile = path.resolve(cwd, "./tsconfig.json");
  
  // Get the mykomap git commit ID from the resolved version (we don't have
  // access to the git repo in this case).
  const mykoMapResolved = (mykoMapPackageJson._resolved || '');
  const mykoMapCommit = mykoMapResolved.replace(/^.*#/, '_').substr(0, 8);
  versionInfo = {
    variant: variant,
    timestamp: timestamp,
    gitcommit: getGitCommit(),
    mykoMapVersion: mykoMapPackageJson.version+mykoMapCommit,
    mykoMapResolvedVersion: mykoMapPackageJson._resolved, // may be undefined
  };
}
fs.writeFileSync(versionJson,
                 JSON.stringify(versionInfo, null, 2));


// Note, if the default entryModulePath is used, the tsconfig.json
// file needs an `"exclude": [ "./ext/" ]` in order that
// typescript files in ./ext are not loaded by `tsc` unless explicitly
// linked via an entry point or an include. 
let entryModulePath = path.join(path.resolve(cwd, mykoMapSrcDir), 'default-app.ts');
if (srcPath) { // -s was supplied, maybe override the default
  const customTsEntryModulePath = path.join(srcPath, 'index.ts');
  const customJsEntryModulePath = path.join(srcPath, 'index.js');
  if (fs.existsSync(customTsEntryModulePath)) {
    entryModulePath = customTsEntryModulePath;
  }
  else if (fs.existsSync(customJsEntryModulePath)) {
    entryModulePath = customJsEntryModulePath;
  }
}
console.log("entry point:", entryModulePath);

// Webpack config for the application
const webpackAppConfig = {
  context: cwd,
  entry: entryModulePath,
  devtool: debug ? "source-map" : false,
  mode: debug? 'development' : 'production',
  target: 'web',
  output: {
    path: destPath,
    filename: "map-app/map-app.js",
    clean: true,
  },
  module: {
    rules: [
	    {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        // Allow TS compiling in node_modules, but exclude all except
        // mykomap, which because it is a git dependency, contains
        // uncompiled typescript.
        options: { allowTsInNodeModules: true, onlyCompileBundledFiles: true },
      },
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
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      // Define this alias so that it works in user code's config/index.ts
      // Note, it needs to be absolute to support use from ext/
      "mykomap": path.resolve(mykoMapSrcDir),
    },
    // Tell webpack not to resolve symlinks. This would make typescript baulk
    // on symlinked files outside this project.
    symlinks: false,
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
        { context: servicesDir, from: "**/*.php", to: "services" },
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

const tempdir = fs.mkdtempSync(path.resolve(os.tmpdir(),'mykomap-site-build'));
const metaGeneratorStem = 'mkMeta';
const metaEntry = path.resolve(tempdir, `${metaGeneratorStem}.ts`);
const metaGeneratorFile = `${metaGeneratorStem}.js`;
const metaGenerator = path.resolve(tempdir, metaGeneratorFile);

// Webpack config for the metaGenerator script
const webpackMkMetaConfig = {
  context: cwd,
  entry: metaEntry,
  devtool: false,
  mode: 'production',
  target: 'node',
  output: {
    path: tempdir,
    filename: metaGeneratorFile,
    clean: true,
  },
  module: {
    rules: [
	    {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        // Allow TS compiling in node_modules, but exclude all except
        // mykomap, which because it is a git dependency, contains
        // uncompiled typescript.
        options: { allowTsInNodeModules: true, onlyCompileBundledFiles: true,
                   configFile: tsConfigFile },
      },
      { // for about.html
        test: /\.html$/i,
        loader: 'html-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      // Define this alias so that it works in user code's config/index.ts
      // Note, it needs to be absolute to support use from ext/
      "mykomap": path.resolve(mykoMapSrcDir),
    },
    // Tell webpack not to resolve symlinks. This would make typescript baulk
    // on symlinked files outside this project.
    symlinks: false,
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'map-app/map-app.css',
    }),
  ],
};

// A promise-API invocation for webpack
const webpackPromise = (config) => {
  return new Promise((resolve, reject) => {
    const cb = (err, stats) => {
      if (err || stats.hasErrors()) {
        reject(new Error(`webpack error: ${stats}, ${err}`));
      }
      else {
        resolve(stats);
      }
    };
    webpack(config, cb);
  });
}

// Function to run the webpack build process
const build = async () => {
  try {
    // Gets the map metadata in a form we can access from the build
    fs.writeFileSync(metaEntry, `
const fs = require('fs');
fs.mkdirSync('${configPath}', {recursive: true});
const outfile = '${configJson}';
const mapMeta = require('${mapConfigModule}').config;
fs.writeFileSync(outfile, JSON.stringify(mapMeta));
    `);
    const metaStats = await webpackPromise(webpackMkMetaConfig);
    console.log(`metadata webpack: ${metaStats}`);

    // Now write the config metadata where the app can pick it up
    console.log("metadata generator is at", metaGenerator);
    console.log("writing map metatdata to", configJson);
    require(metaGenerator); // Executes metaGenerator. We can't get any result back though...?
    
    // Generates the application
    const appStats = await webpackPromise(webpackAppConfig);
    console.log(`application webpack: ${appStats}`);
  }
  catch(err) {
    die(err.message);
  }
}

build();
