#!/bin/bash

git remote update > /dev/null

if [[ "$(git status -uno)" != *"Your branch is up-to-date"* ]]; then
  echo "Error: The git repo is not up-to-date. Please run `git pull` first." >&2
  exit 1
fi

echo "BEFORE DEPLOYING, make sure the version number in appengine-web.xml is correct. Press CTRL+C to cancel, or Enter to continue: "
read input

set -e
set -x

# Copy wescheme-compiler libraries
./generate-js-runtime.sh

# Following is necessary to avoid hitting compression bug
rm war/js/mzscheme-vm/*-min.js
./bin/compress-js.rkt war/js/mzscheme-vm/support.js
./build-console-and-editor.rkt

# Compile Java source
ant compile

# Now upload
./lib/appengine-java-sdk-1.9.60/bin/appcfg.sh update war
