#!/bin/bash

orig_dir=`pwd`
target_new=$orig_dir/war/js/mzscheme-vm/support-new.js
platform=browser
testing=false

echo 'Building support.js:';

pushd war-src/js/js-runtime/ > /dev/null

if [ -f $target_new ]; then
	rm -f $target_new 
fi

if [ -f $platform-platform.js ]; then
	echo "    Adding platform-specific code for $platform";
	cat $platform-platform.js >> $target_new;
    else
	echo "    Requires a platform (either \"browser\" or \"node\")"
	exit -1
fi

echo '    Concatenating main source files';
for i in `cat order`; do
	echo '        adding' $i;
	cat $i >> $target_new;
done;

if [ "$testing" = true ]; then
	echo '    Adding exports for testing'
	cat exports.js >> $target_new;
fi

echo '    Done!'

popd > /dev/null
exit 0