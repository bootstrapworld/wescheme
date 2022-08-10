#!/bin/sh

# install cloud sdk if it's not already installed
if ! [ -d lib/google-cloud-sdk/ ]
then
    echo "The Google Cloud SDK hasn't been installed yet"
    echo "Running silent deployment script...(from https://cloud.google.com/sdk/docs/downloads-interactive#silent)"
    curl https://sdk.cloud.google.com > install.sh
    bash install.sh --disable-prompts --install-dir=lib/
    rm install.sh
fi


# Adapted from https://stackoverflow.com/a/3278427/718349
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
    echo "Error: The git repo is not up-to-date. Please run git pull first." 1>&2
    exit 1
fi

appengine_versions=$(gcloud app versions list)
echo $appengine_versions
versions=$(echo $appengine_versions | sed -e 's/default /\n\0/g' | sed -e '1d' -e 's/^[^ \t]\+[ \t]\+\([^ \t]\+\).*/\1/')

echo "Following are all versions:"
echo $versions

echo "Deploying with version string: $1"

echo
echo -n "BEFORE DEPLOYING, make sure the version string is correct! Press CTRL+C to cancel, or Enter to continue: "
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
gcloud app deploy war/WEB-INF/appengine-web.xml --version $1 --no-promote