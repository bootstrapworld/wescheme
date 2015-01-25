#!/bin/bash

orig_dir=`pwd`
target=$orig_dir/war/js/mzscheme-vm/support.js
platform=browser
testing=false

echo 'Building support.js:';

pushd war-src/js/js-runtime/ > /dev/null

if [ -f $target ]; then
	rm -f $target 
fi

if [ -f $platform-platform.js ]; then
	echo "    Adding platform-specific code for $platform";
	cat $platform-platform.js >> $target;
    else
	echo "    Requires a platform (either \"browser\" or \"node\")"
	exit -1
fi

echo '    Concatenating main source files';
for i in `cat order`; do
	echo '        adding' $i;
	cat $i >> $target;
done;

if [ "$testing" = true ]; then
	echo '    Adding exports for testing'
	cat exports.js >> $target;
fi

echo '    Done!'

popd > /dev/null
exit 0