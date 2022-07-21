# DEVELOPMENT

## Synopsis

Clone sea-map, and a website project to develop with:

    git clone http://github.com/SolidarityEconomyAssociation/sea-map
    git clone http://github.com/SolidarityEconomyAssociation/sea-site-experiment

Check out the `dev` branch of sea-map and (typically) create a feature
branch, named with the a prefix indicating the issue the branch
addresses. Try and be consistent with the initials, see [FEATURE
BRANCHES][#FEATURE-BRANCHES] below.

	cd sea-map
	git co dev
	git co -b sm99-some-feature
	
Symlink the website project directory as `ext` (or move it here, if
symlinks are not available).

	ln -sfn ../sea-site-experiment ext

And in order for this to work with a typescript `index.ts` entry point
(but not needed for a `index.js`, or indeed no custom entry point at
all) the symlinked project under ext/ needs a tsconfig.json, and in
particular, one with a path linking back to the map-app source dir in
sea-map's repository:
    
    {
      "include": [
        "node_modules/sea-map"
      ],
      "compilerOptions": {
        "paths": {
          "sea-map/*": ["./node_modules/sea-map/www/map-app/*","../www/map-app/*"]
        },
        [... your options here ...]
      }
    }


Install the prerequisites

	apt install php php-curl rsync # On Debian
	npm run install
	
Run the development web server in the background (do this in a separate console):

    npm run build && npm run server &

Hack on the code... remember to keep commits small and as
self-explanatory as possible. Rebuild, and test in the browser. Then
when ready to make a development deployment:

    git commit -m "my latest changes..."
	npm run dev-deploy -- -t me@example.com:/path/to/webroot 

When ready to make a release, set the new semantic version number and
push the code and the tags:

    git commit -m "my latest changes..."
	npm version $NEW_VERSION       # e.g 1.2.0 (no leading 'v')
	git push --tags                # <-- DON'T FORGET THIS STEP!

Dependant projects can then be updated to use it like this (for
example):

    npm update # You may need to specify versions if a major version increment,
    # like this (where $NEW_VERSION is for example '1.0.0')
    # npm install github:SolidarityEconomyAssociation/sea-map#semver:^$NEW_VERION 
    npm run build
	npm run deploy


## Deployment

The standard way to deploy a website which uses sea-map is to execute
the following *within the website project directory* (assuming
run-scripts have been set up as recommended).

    npm install
	# or: `npm upgrade` if you merely wish to update deps like sea-map
	# See https://www.npmjs.com/package/npm-upgrade
	
	npm run build
	npm run deploy # this will deploy to the configured `deploy_to` URL

See the [USAGE](README.md#USAGE) section of README.md and the
documentation within [sea-site-deploy][] script for these
recommendations and how specifying where to deploy.

For development, however, the sea-map run-script `dev-deploy` is
designed to make a deployment which is correctly labelled as a
development build in `version.json`, and the sidebar then reports this
version.  From *within the sea-map project directory*:

    npm run build
	npm run dev-deploy -- -t me@example.com:/path/to/webroot 


## Versioning sea-map

Currently we typically add the sea-map repository as a git
dependency. Meaning the library is sourced directly from git, rather
than needing to be published in the NPM package registry. So the
dependency in a consuming project's `package.json` looks something
like this:

	  "dependencies": {
		"sea-map": "github:SolidarityEconomyAssociation/sea-map#semver:^0.1.45",
		...
	  },

The caret (`^`) before the version implies that any compatible version
newer than the one specified can be used. With [semantic
versioning][semver], this means any minor/patch version equal to or
newer than the given one can be used.  See the [package.json
dependencies][dependencies] documentation for more details of what
caret and tilda symbols mean in dependency specifiers.

As such you might expect this to install 0.1.46 and above, up to but
excluding 1.0 - if any of these versions are available.

However, although this is how packages deployed from the npm package
registry, when deployed from git npm seems only to install the exact
named tag (or branch or commit). Therefore newer versions do not seem
to get installed.

Consequentially we need to apply a new version number every time a
change is made which we want deployed, to name that version in the
packages depending on sea-map.

It is also important that the Git tag is not applied *before* the
`package.json` version is changed. Otherwise `npm update` in a project
using `sea-map` will update it to the latest *tagged version*, but
that will not have the latest version in `package.json`. This could
cause problems in the consuming package, or miss out features, or at
least create confusion should the user run `npm outdated`, as npm gets
the source code from the latest tagged commit, not the one where the
version was changed in `package.json`.

Furthermore: 
- tags need to follow the format `v0.1.45` (i.e. with a 'v'
  prefix), or they will not be interpreted as versions.
- the package.json and package-lock.json files need to be in sync with
  this version (or we will have the wrong version reported)

## Release process

In order to avoid problems as described above, the suggested release
process, having committed changes to sea-map is:

    git commit -m "my latest change..."
	npm version $NEW_VERSION
	git push --tags
	
Where `$NEW_VERSION` is a semantic version without the preceeding 'v'.

The [npm version][version] command will update all the package
metadata, commit the changes, and tag the commit with the new version
number (correctly preceeded with a 'v'), in a single step, so that
they don't get out of sync.

The `--tags` option is required for `git push` to push tags as well as
commits.

## Updating websites

Websites depending on sea-map can be updated to use the latest version
of sea-map when it has been changed, using:

    npm update
	
This should output something like this:

    + sea-map@0.1.47
    updated 1 package and audited 2 packages in 3.358s
    found 0 vulnerabilities

Although note that the dependency version specifier in the dependent's
`package.json` does not get changed. Instead, changes go to
`package-lock.json`, with a new git commit ID written. This should be
committed in the dependent's repository.

[version]: https://docs.npmjs.com/cli-commands/version.html
[semver]: https://docs.npmjs.com/about-semantic-versioning
[dependencies]: https://docs.npmjs.com/configuring-npm/package-json#dependencies
[sea-site-deploy]: ./bin/sea-site-deploy
