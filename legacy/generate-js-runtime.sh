#!/bin/bash

orig_dir=`pwd`
target_new=$orig_dir/static/mzscheme-vm/support-new.js
platform=browser
testing=false

echo 'Building support.js:';

pushd js-src/js-runtime/ > /dev/null

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
# The for-loop below breaks on windows. Hard-coding fixes it.
#for i in $(cat order); do
#	echo '        adding' $i;
#	cat $i >> $target_new;
#done;
cat json2.js >> $target_new;
cat helpers.js >> $target_new;
cat json2.js >> $target_new;
cat helpers.js >> $target_new;
cat world/jsworld/jsworld.js >> $target_new;
cat js-numbers.js >> $target_new;
cat jshashtable.js >> $target_new;
cat types.js >> $target_new;
cat state.js >> $target_new;
cat md5.js >> $target_new;
cat world/world-config.js >> $target_new;
cat world/world-stimuli.js >> $target_new;
cat world/world.js >> $target_new;
cat world/jsworld.js >> $target_new;
cat primitive.js >> $target_new;
cat control.js >> $target_new;
cat loader.js >> $target_new;
cat interpret.js >> $target_new;

if [ "$testing" = true ]; then
	echo '    Adding exports for testing'
	cat exports.js >> $target_new;
fi

echo '    Done!'

popd > /dev/null
exit 0