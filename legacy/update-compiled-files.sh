#!/bin/bash
# $1 is the path to the newly-compiled file
# $2 is the path to the original file

orig_dir=`pwd`
new=$orig_dir/$1
old=$orig_dir/$2

# if this is our first time building, make an empty $old file
if ! [ -f $old ] 
then 
	touch $old 
	echo $old " does not exist. Creating blank file."
fi

# if the new one is different, replace it
if diff $old $new > /dev/null
then
    echo $2 "is unchanged."
    rm -f $new
else
    echo $2 " has been updated!"
    rm -f $old
    mv $new $old
fi

exit 0