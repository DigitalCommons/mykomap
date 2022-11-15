This file lists things known to have changed or broken due to changes
in new major versions.

# 3.0.0

internally:
- renamed as mykomap everywhere
- typescript used extensively (although not universally)

consumer packages:
- should supply config in an index.ts file
- need to specify -s src/ to pick up index.ts files
- config schema changed, in particular for sourcing vocabs and data


# 2.0.0

- `www` is no longer a configured default in the `searchableValues`
  list. Add it if you need it.
- web content now goes in `./www`, not `./src`
- `./src` is now where a custom entry point can be put.
