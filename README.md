# PACKAGE

map-app - A web application for mapping initiatives in the Solidarity Economy

# USAGE

This package is designed to supply the basic source and web assets for
a Solidarity Economy Association map website.  This is tailored for a
particular case by a configuration file, and an about.html page,
supplied by the consumer site package.

The consumer package should supply a script target to build itself
like this, which uses the `sea-site-build` script exported by this
package.

The "dev" package is a suggestion for allowing local hosting of the
site for development, using the command-line PHP executable's facility
to launch a web server. (On Debian and related distros, you'll need
the `php-cli` and `php-curl` packages.)

```
  "scripts": {
    "build": "generate-version $npm_package_name >config/version.json && sea-site-build config node_modules/sea-map node_modules/sea-dataserver build",
    "dev": "php -t build/out -S localhost:8080"
  },
```


Given these, basic usage of a consuming NPM package therefore would
look like this:

    npm install         # Download the dependencies
	npm run build       # Build and minify the source into builds/out
    npm run def         # Launch a development web server on http://localhost:8080

# CONSUMING PACKAGE REQUIREMENTS

These need to have a configuration directory containing:

 - `about.html` - containing mark-up which will be displayed on the about tab in the sidebar
 - `config.json` - configuration parameters, see beloow
 - *<dataset>*/ - a directory for each dataset named in the config, containing parameters for the SPARQL query to send to Virtuoso (these will be url-encoded):
   - `query.rq` - the `query` parameter to pass
   - `default-graph-uri.txt` - the `default-graph-uri` parameter to pass
   - `endpoint.txt` - the base URL to the Virtuoso server

The NPM `sea-map` package needs to be a dependency, which exports the
`sea-site-build` script.

The package needs to invoke it like this(typically as an npm build
script target):

     sea-site-build $config_dir node_modules/sea-map node_modules/sea-dataserver $build_dir",

Where:

  - `$config_dir` is the path to the configuration directory mentioned above
  - `node_modules/sea-map` is the path to the `sea-map` package directory
  - `node_modules/sea-dataserver` is the path to the `sea-dataserver` package directory
  - `$build_dir` is the path in which to build the site.
  
`$build_dir` will be populated with two directories:

 - `in` - which contains a RequireJS `build.js` script and the assets
   it needs (linked from eleewhere)
 - `out` - the generated site content

`build/out` can then be served by a (PHP enabled) web server directly,
or packaged for deployment.

## CONFIG.JSON
 
This JSON file defines the defaults for a map-app. Put in at the path
`config/config.json` within the NPM project consuming sea-map
(relative to `package.json`). Note, because it is JSON, comments are
not allowed and all keys must be delimited by double-quotes. Double
quotes are the only string delimiter.

The valid configuration attributes defined in [CONFIG.md][CONFIG.md].
This is regenerated automatically from the config schema defined in
[www/map-app/app/model/config.js][config.js]) by running the
`generate-config-doc` NPM run script. Run this whenever the config changes.

[CONFIG.md]: ./CONFIG.md
[config.js]: ./www/map-app/app/model/config.js

# DEVELOPMENT

Developing `sea-map` needs a way to deploy a website using it for
testing. Doing this via a dependency from (say) the [`playground`][1]
project to `sea-map` is a bit cumbersome if changes to `sea-map` need
to be propagated back to the consuming project via pushing the changes
under test to github.

It is also possible to change a `package.json` dependency on `sea-map`
to a relative path. But this also doesn't work well, because

1. This change mustn't be checked in, but more seriously
2. It doesn't then pull in the RequireJS dependency correctly.

The latter seems to be a known problem with npm.

So, a suggested simpler way is to embed a simple project using
`sea-map` within a subdirectory `ext`, either directly (from within
the same directory as this README):

    git clone $PROJECT_URL ext

Or using a symlink:

    ln -sf $PROJECT_PATH ext

A pair of npm script tasks to build and serve that directly have been
added to `package.json`, so given the above, you can the build and
serve the project like this:

    npm install    # installs sea-map deps
	npm run build  # builds the embedded project in ext/build/out
	npm run serve  # serves the embedded project in ext/build/out

The website, using the under-development version of `sea-map`, will
then be accessible locally via the URL http://localhost:8080

*Caveat:* the embedded project should not have any extra dependencies
beyond `sea-map`, because the `npm install` above will not find those.

# SCRIPT TARGETS

This package does little in its own right. The following are the
script targets it supports.

    npm lint
	
Runs a static analysis of the source, highlighting possible improvements

    npm build

Assuming a project consuming sea-map (such as [playground][1])has been
symlinked (or installed) into `ext/`, this builds that dependent
project. Primarily for the sea-map developers' convenience, rather
than any users of sea-map.

[1]: https://github.com/SolidarityEconomyAssociation/playground

    npm serve

As above, a sea-map developers' convenience. Launches a PHP
development web-server, publishing a project consuming sea-map in
`ext/`

    npm generate-config-doc
	
Developer convenience. Regenerates the documentation for `config.json`
in `CONFIG.md`. Developers should run this when the schema definitions
in `config_schema.js` are changed.
