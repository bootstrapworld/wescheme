#!/bin/sh
set -e
./build-console-and-editor.rkt
./copy-compiler-libraries.sh
./lib/appengine-java-sdk-1.7.3/bin/appcfg.sh update war
