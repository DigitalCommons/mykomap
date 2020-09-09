# Versioning sea-map

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
registry, when deployed from git npn seems only to install the exact
named tag (or branch or commit). Therefore newer versions do not seem
to get installed.

Consequentially we need to apply a new version number every time a
change is made which we want deployed, and to name that version in the
packages depending on sea-map.

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
number (correctly preceeded with a 'v').

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
