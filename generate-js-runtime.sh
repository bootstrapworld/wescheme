#!/bin/bash

orig_dir=`pwd`
target=$orig_dir/war/js/mzscheme-vm/support.js
platform=browser
testing=false

echo 'Building support.js:';

pushd war-src/js/js-runtime/

rm -f $target

$target

if [ -f $platform-platform.js ]
    then
	echo '    Adding platform-specific code';
	cat $platform-platform.js >> $target;
    else
	echo "    Requires a platform (either \"browser\" or \"node\")"
	exit
fi

echo 'Concatenating main source files';
for i in `cat order`; do
	echo '    adding' $i;
	cat $i >> $target;
done;

if [ "$testing" = true ]; then
	echo 'Adding exports for testing'
	cat exports.js >> $target;
fi

echo
echo '    Done!'

popd
