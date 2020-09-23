#!/bin/sh

# Adapted from https://stackoverflow.com/a/3278427/718349

echo "deploying version" $1
git remote update > /dev/null

UPSTREAM='@{u}'
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")

if [ $LOCAL = $REMOTE ]; then
    :
elif [ $REMOTE = $BASE ]; then
    :
else
    echo "Error: The git repo is not up-to-date. Please run git pull first." >&2
    exit 1
fi

python_grep() {
  echo "python -c \"import sys, re; print(re.search('$1', sys.stdin.read()).group(0))\""
}

versions="$(./lib/appengine-java-sdk-1.9.60/bin/appcfg.sh list_versions war 2>/dev/null | eval $(python_grep '(?ms)(?<=^default: ).*?]') )"

echo "Following are all versions: $versions"
echo
current_version="$(cat war/WEB-INF/appengine-web.xml | eval $(python_grep '(?<=version>)'))"

echo "The current version number in war/WEB-INF/appengine-web.xml is: $current_version"


echo
echo -n "BEFORE DEPLOYING, make sure the version number is correct. Press CTRL+C to cancel, or Enter to continue: "
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
#./lib/appengine-java-sdk-1.9.60/bin/appcfg.sh update war
gcloud app deploy war/WEB-INF/appengine-web.xml --version $1 --no-promote