// browser-specific hooks and definitions
var sys = {};

sys.print = function(str) {
	var s = str.toString().replace(new RegExp('\n', 'g'), '<br />');
	document.write(s);
};

sys.error = function(e) {
    if (typeof(console) !== 'undefined' && console.log) {
		if (e.stack) {
			console.log(e.stack);
		}
		else {
			console.log("Error: " + str);
		}
	}
	else {
		var s = e.toString().replace(new RegExp('\n', 'g'), '<br />');
		s = "<br />Error: " + s + "<br />";
		document.write(s);
	}
};


sys.inspect = function(x) {
    // FIXME: add more helpful inspect function that'll show
    // us what's really inside.  Perhaps use toString()?
    return x + '';
};


var DEBUG_ON = false;

var setDebug = function(v) {
    DEBUG_ON = v;
}

var debug = function(s) {
    if (DEBUG_ON) {
	sys.print(s);
    }
}

var debugF = function(f_s) {
    if (DEBUG_ON) {
	sys.print(f_s());
    }
}


var hasOwnProperty = {}.hasOwnProperty;

var deepEqual = function (obj1, obj2) {
    if (obj1 === obj2) {
	return true;
    }

    var i;
    if (obj1 instanceof Array) {
        if (obj2 instanceof Array) {
            for (i = 0; i < obj1.length; i++) {
                if (! deepEqual(obj1[i], obj2[i])) { return false; }
            }
            return true;
        } else {
            return false;
        }        
    }

    if (typeof(obj1) === 'string' || typeof(obj1) === 'number') {
        return obj1 === obj2;
    }

    for (var i in obj1) {
	if ( hasOwnProperty.call(obj1, i) && i !== '_eqHashCode' && i !== '_isList') {
	    if ( !(hasOwnProperty.call(obj2, i) && deepEqual(obj1[i], obj2[i])) )
		return false;
	}
    }
    for (var i in obj2) {
	if ( hasOwnProperty.call(obj2, i) && i !== '_eqHashCode' && i !== '_isList') {
	    if ( !(hasOwnProperty.call(obj1, i) && deepEqual(obj1[i], obj2[i])) )
		return false;
	}
    }
    return true;
}


var assert = {};

assert.equal = function(x, y) {
    if (x !== y) {
	throw new Error('AssertError: ' + x + ' equal ' + y);
    }
}

assert.deepEqual = function(x, y) {
	if ( !deepEqual(x, y) ) {
	    throw new Error('AssertError: ' + x + ' deepEqual ' + y);
	}
}


assert.ok = function(x) {
	if (!x) {
		throw new Error('AssertError: not ok: ' + x );
	}
}


assert.throwsExn = function(f) {
	try {
		f.apply(null, []);
	} catch (e) {
		return;
	}
	throw new Error('AssertError: Throw expected, none received.');
}
