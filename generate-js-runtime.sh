#!/bin/bash

orig_dir=`pwd`
target=$orig_dir/war/js/mzscheme-vm/support.js
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

# if the new one is different, replace it
if diff $target_new $target > /dev/null
then
    echo "No difference in support.js. Keeping old one."
    rm -f $target_new
else
    echo "support.js has been updated! Replacing."
    rm -f $target
    mv $target_new $target
fi

echo '    Done!'

popd > /dev/null
exit 0