# PACKAGE

mykomap - A web application for mapping initiatives in the Solidarity & Co-operative Economies

## Status

| Service: | `master` | `dev` |
| -------: | :------: | :---: |
| Testing: | ![npm test master] | ![npm test dev] |

[npm test master]: https://github.com/DigitalCommons/mykomap/actions/workflows/node.js.yml/badge.svg?branch=master
[npm test dev]: https://github.com/DigitalCommons/mykomap/actions/workflows/node.js.yml/badge.svg?branch=dev

# USAGE

(Also prerequisites section below)

This package is designed to supply the basic source and web assets for
a Digital Commons map website.  This is tailored for a
particular case by a configuration file, and an about.html page,
supplied by the consumer site package.

The consumer package should supply a run-script target to build
itself, as in the example below, which uses the `mykomap-site-build`
script exported by this package.

```
  "scripts": {
    "build": "mykomap-site-build -c config -m -s src node_modules/mykomap -d build src/*",
    "deploy": "mykomap-site-deploy",
    "server": "php -t build/out -S localhost:8080"
  },
```

Additionally, this illustrates two other suggested run-scripts:
`deploy` and `server`.

The `server` run-script illustrates how to run a web server for
testing the site without deploying, for development. It uses the
command-line PHP executable's facility to launch a web
server. (Remember to build the site before running this.)

The `deploy` run-script illustrates how to deploy the web site to a
remote location. It uses the `mykomap-site-deploy` script, which
internally uses `rsync`. (Again, remember to build first.) 

Given these, basic usage of a consuming NPM package therefore would
look like this:

    npm install         # Download the dependencies
    npm run build       # Build and minify the source into builds/out
    npm run server      # Launch a development web server on http://localhost:8080

And to deploy it, either configure a target specific to your package,
which in this example is called `mypackage`:

	npm config set mypackage:deploy_to=joe@example.com:/some/path
	npm run deploy
	
Or, you can override any configured values via the command line like
this:

	npm run deploy -- -f some/where -t joe@example.com:/some/path

This is to support scripting the deploy step. See the inline
documentation within [mykomap-site-deploy](bin/mykomap-site-deploy) for further
details.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for more information about
building and deploying mykomap websites during development of mykomap.


# PREREQUISITES

Besides a modern version of NPM and NodeJS, this package needs the
following command line tools:

- `bash` - or possibly any Bourne-shell compatible shell (untested)
- `rsync` - a file transfer utility
- `php` - the command-line version of PHP

Additionally, the PHP `curl` module needs to be installed. 

On Debian and related distros, Bash comes by default, and you can
install the others with:

    apt install rsync php-cli php-curl
	
On Windows 10 and above, you can install these via the [Windows
Subsystem for Linux][WSL].

NPM toolchain prerequisites are listed in `package.json` and installed
with `npm install`.


# CONSUMING PACKAGE REQUIREMENTS

These need to have a configuration directory containing:

 - `about.html` - containing mark-up which will be displayed on the about tab in the sidebar
 - `config.json` - configuration parameters, see beloow
 - *&lt;dataset&gt;*/ - a directory for each dataset named in the config, containing parameters for the SPARQL query to send to Virtuoso (these will be url-encoded):
   - `query.rq` - the `query` parameter to pass
   - `default-graph-uri.txt` - the `default-graph-uri` parameter to pass
   - `endpoint.txt` - the base URL to the Virtuoso server

The NPM `mykomap` package needs to be a dependency, which exports the
`mykomap-site-build` script.

The package needs to invoke it like this(typically as an npm build
script target):

    mykomap-site-build -c config -s src -m node_modules/mykomap  -d build src/*

Where:

 - `config` is the path to the configuration directory mentioned above
 - `src` is an optional path to a custom entry point (index.ts or
   index.js) and related source code
 - `node_modules/mykomap` is the path to the `mykomap` package directory
 - `build` is the directory in which to build the site
 - `src/*` expands to a list of directories to include in the build
  
`build` will be populated with two directories:

 - `in` - which contains a RequireJS `build.js` script and the assets
   it needs (linked from eleewhere)
 - `out` - the generated site content

`build/out` can then be served by a (PHP enabled) web server directly,
or packaged for deployment.


## CONFIG.JSON
 
This JSON file defines the defaults for a mykomap. Put in at the path
`config/config.json` within the NPM project consuming mykomap
(relative to `package.json`). Note, because it is JSON, comments are
not allowed and all keys must be delimited by double-quotes. Double
quotes are the only string delimiter.

The valid configuration attributes defined in [CONFIG.md][CONFIG.md].
This is regenerated automatically from the config schema defined in
[src/map-app/app/model/config.js][config.js]) by running the
`generate-config-doc` NPM run script. Run this whenever the config changes.


## OVERRIDING CONFIG.JSON ATTRIBUTES

Some of these may be tweaked in various ways, to allow users of the
library some flexibility, as follows. Methods are listed in order of
increasing priority - if the parameter is defined different ways, the
latter override the former.

Only those attributes which are settable (as defined in [CONFIG.md])
can be overridden. When being set from a context which can only supply
string values, these are parsed into a valid value.

### In the `<div id="map-app">` element

For example, you can define the `div` like this to override values:

    <div id="map-app"
	     map-app:html-title="My Title"
	     map-app:initial-bounds="40.712,-74.227,40.774,-74.125" 
	>
	</div>

Here, a config attribute name like `initialBounds` should be defined
as `map-app:initial-bounds`. There's a namespace prefix to make sure
there can't be clashes with existing HTML attributes. Also,
hyphenation is used instead of capitalisation. The reason for this is
that HTML elements' attributes are case-insensitive. The case can't be
accessed from Javascript because they effectively get downcased before
Javascript even sees them.

### In URL query parameters.

For example, you can load the webpage containing the `div` with ID
`map-app` with query parameters like this:

    http://example.com/map?initialBounds=40.712,-74.227,40.774,-74.125

You'll need URL escaping where necessary: a space should be denoted
with a `+`, a question mark with `%3B`, etc. You can use the
Javascript built-in function `encodeURIComponent` to do this. Multiple
parameters should be delimited by ampersands or semi-colons, as usual.

(Note, these parameters are parsed on the client-side in the
Javascript, so no extra PHP or Apache scripts needed for it to work.)

The upshot of this is that you can embed the map hosted on (say)
`server1.example.com` in a page on `server2.example.com` using an
`iframe` element in a web page on the latter referring to the
former. The element should set the configuration paramters in the URL
as above. So a super simple example might be:

    <!DOCTYPE html>
	<html>
	  <head><!-- ... --></head>
	  <body>
	    Blah blah

        <iframe src="https://server1.example.com/index.html?initialBounds=40.712,-74.227,40.774,-74.125"></iframe>
	  </body>
	</html>

This example omits all styling and layout, etc., which is out of the
scope of this document.

(Note that setting the parent page's title using the `htmlTitle`
parameter won't work in this context, however, since the title of the
page inside the `iframe` isn't visible to the user.)

If you wish to adjust the initial position of the map using the
`initialBounds` paramter, here is a rough guide to finding the correct
coordinates.

 - Visit https://openstreetmap.org,
 - Navigate so that the position of one of the corners of the initial bounds is in view.
 - Right-click on the exact location, and
 - A pop-up menu appears. Select 'Show address'.
 - A side-bar should open showing the latitiude and longitude coordinates of this point.
 - Record this, and repeat for the opposite corner.
 - Concatenate these numbers with commas, like this: `<lat1>,<long1>,<lat2>,<long2>`
 - Use this as the `initialBounds` parameter value

### In code

If the map-app `init()` function defined in `app/main.js` is called
directly, a object defining config attributes can be supplied as the
first parameter. From HTML, for example:

    <script src="lib/require.js"></script>
    <script type="application/javascript">
    
    require(['app/main'], function(main) {
        main.init({
            initialBounds: [[40.712,-74.227],[40.774,-74.125]],
            htmlTitle: "My Title",
        });
    });
    
    </script>

Note, this actually bypasses any HTML attribute or URL parsing, so if
you use this method these won't happen at all. Typically you won't be
doing this, as it requires understanding of RequireJS.


# DEVELOPMENT

Developing `mykomap` needs a way to deploy a website using it for
testing. Doing this via a dependency from (say) the [`mykomap-site-example`][1]
project to `mykomap` is a bit cumbersome if changes to `mykomap` need
to be propagated back to the consuming project via pushing the changes
under test to github.

It is also possible to change a `package.json` dependency on `mykomap`
to a relative path. But this also doesn't work well, because

1. This change mustn't be checked in, but more seriously
2. It doesn't then pull in the RequireJS dependency correctly.

The latter seems to be a known problem with `npm`.

So, a suggested simpler way is to embed a simple project using
`mykomap` within a subdirectory `ext`, either directly (from within
the same directory as this README):

    git clone $PROJECT_URL ext

Or using a symlink:

    ln -sf $PROJECT_PATH ext

A pair of npm script tasks to build and serve that directly have been
added to `package.json`, so given the above, you can the build and
serve the project like this:

    npm install    # installs mykomap deps
	npm run build  # builds the embedded project in ext/build/out/
	npm run server  # serves the embedded project in ext/build/out/

The website, using the under-development version of `mykomap`, will
then be accessible locally via the URL http://localhost:8080

*Caveat:* the embedded project should not have any extra dependencies
beyond `mykomap`, because the `npm install` above will not find those.


# SCRIPT TARGETS

This package does little in its own right. The following are the
script targets it supports.

    npm lint
	
Runs a static analysis of the source, highlighting possible improvements

    npm build

Assuming a project consuming mykomap (such as [mykomap-site-example][1])has been
symlinked (or installed) into `ext/`, this builds that dependent
project. Primarily for the mykomap developers' convenience, rather
than any users of mykomap.

    npm server

As above, a mykomap developers' convenience. Launches a PHP
development web-server, publishing a project consuming mykomap in
`ext/`

    npm generate-config-doc
	
Developer convenience. Regenerates the documentation for `config.json`
in `CONFIG.md`. Developers should run this when the schema definitions
in `config-schema.ts` are changed.

# MISCELLANEA

Information which doesn't quite fit in anywhere above.

## Tips for identifying deployed mykomap parameters

Sometimes you might want to see just what version a mykomap deployment 
is, which datasets it is using, or what the SPARQL query is. 

Even if this isn't possible to infer from the map, the mykomap
configuration resources (described above) can be inspected in a browser.

The following files will be present, at least, and possibly more 
with `.rq` suffixes, defining other queries. 

 - `about.html`
 - `config.json`
 - *&lt;dataset&gt;*/
   - `query.rq`
   - `default-graph-uri.txt`
   - `endpoint.txt`

The name of the folder *&lt;dataset&gt;* is up to you,
its contents may include additional files, and you may have
more than one folder. If the web server does not show file indexes,
you will need to know the names of these in advance.

Strictly, the location of these resources is defined 
relative to the `map-app.js` source code. So using 
`dotcoop.solidarityeconomy.coop` as an example deployment, 
if the `map-app.js` file is published here:

https://dotcoop.solidarityeconomy.coop/map-app/map-app.js

...Then the configuration is published in an adjacent directory 
`configuration`. (Note that the word "configuration" is not 
abbreviated here, as it is in the source code directory above.)

Specifically, `config.json` will be here:

https://dotcoop.solidarityeconomy.coop/configuration/config.json

So if your app deploys `mykomap` code like the example, you can append 
`configuration/config.json` to the default map URL to find 
`config.json` and the other resources. Like this:

- https://dotcoop.solidarityeconomy.coop/configuration/about.html
- https://dotcoop.solidarityeconomy.coop/configuration/version.json
- https://dotcoop.solidarityeconomy.coop/configuration/dotcoop/query.rq
- https://dotcoop.solidarityeconomy.coop/configuration/dotcoop/endpoint.txt
- https://dotcoop.solidarityeconomy.coop/configuration/dotcoop/default-graph-uri.txt

### Pre `mykomap` versions of the map app

Note that before the map-app was converted into this NPM package, 
the configuration was located in a slightly different path relative to
`map-app/map-app.js`. For example, at the time of writing the Oxford
map predates `mykomap` and the configuration can be found here (and the 
other files in their respective relative locations):

https://oxford.solidarityeconomy.coop/map-app/configuration/config.json

The location was changed to permit separation of the source code from
the configuration files.



[1]: https://github.com/DigitalCommons/mykomap-site-example
[WSL]: https://docs.microsoft.com/en-gb/windows/wsl/install-win10
[CONFIG.md]: ./CONFIG.md
[config.js]: ./src/map-app/app/model/config.js

