// Various imports and support for use with node
var sys = require('sys');
var assert = require('assert');

sys.error = function(str) {
	sys.print("Error: " + str);
};

var DEBUG_ON = false;

var setDebug = function(v) {
    DEBUG_ON = v;
}

var debug = function(s) {
    if (DEBUG_ON) {
	sys.debug(s);
    }
}

var debugF = function(f_s) {
    if (DEBUG_ON) {
	sys.debug(f_s());
    }
}

// define window as the global object
// so things designed to work in the browser don't fail
var window = this;


