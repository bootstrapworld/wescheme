#!/bin/sh
set -e
set -x
./build-console-and-editor.rkt
./copy-compiler-libraries.sh
./lib/appengine-java-sdk-1.8.8/bin/appcfg.sh --use_java7 update war
##ant update
