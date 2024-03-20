//var types = require('./types');



// Represents the interpreter state.


var state = {};

(function () {

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


var defaultPrintHook = function(thing) { 
    sys.print(types.toWrittenString(thing) + "\n"); };

var defaultDisplayHook = function(thing) { 
    sys.print(types.toDisplayedString(thing)); };

var defaultToplevelNodeHook = function() { 
    throw new Error("There is a software configuration error by the system's maintainer: the toplevel node has not been initialized yet.");
};

var defaultDynamicModuleLoader = function(moduleName, successCallback, errorCallback){ 
    errorCallback(moduleName +" not known"); 
};


// Interpreter
var State = function() {
    this.v = [];       // value register
    this.vstack = [];  // value stack
    this.cstack = [];  // control stack
    this.heap = {};    // map from name to closures
    this.globals = {}; // map from string to types.GlobalBucket values
    this.hooks = { printHook: defaultPrintHook,
		   displayHook: defaultPrintHook,
		   toplevelNodeHook: defaultToplevelNodeHook,
		   imageProxyHook: false,
                   dynamicModuleLoader: defaultDynamicModuleLoader
                 };

    this.invokedModules = {};

    // Internal flag: if set, then we stop evaluation immediately.
    this.breakRequested = false;
    this.breakRequestedListeners = [];
};

var isState = function(o) {
  return o instanceof State;
};



// clearForEval: -> void
// Clear out the value register, the vstack, and the cstack.
State.prototype.clearForEval = function(attrs) {
    this.v = [];
    this.vstack = [];
    this.cstack = [];


    // FIXME: what should happen to globals here?
    if (attrs && attrs.preserveBreak) {
    } else {
      this.breakRequested = false;
      this.breakRequestedListeners = [];
    }


    if (attrs && attrs.clearGlobals) {
      this.globals = {};
    } else {
    }
};


State.prototype.save = function() {
    return { v: this.v,
	     vstack: this.vstack.slice(0),
	     cstack: this.cstack.slice(0),
	     heap: this.heap,
	     globals: copyHash(this.globals),
             hooks: this.hooks,
	     breakRequested: this.breakRequested,
	     breakRequestedListeners: copyHash(this.breakRequestedListeners),
	     invokedModules: this.invokedModules };
};


var hasOwnProperty = {}.hasOwnProperty;

var copyHash = function(hash) {
    var result = {};
    for (var key in hash) {
	if (hasOwnProperty.call(hash, key)) {
	    result[key] = hash[key];
	}
    }
    return result;
};


State.prototype.restore = function(params) {
    this.v = params.v;
    this.vstack = params.vstack;
    this.cstack = params.cstack;
    this.heap = params.heap;
    this.globals = params.globals;
    this.hooks = params.hooks;
    // DELIBERATE: don't restore breakRequested
    // this.breakRequested = params.breakRequested;
    this.breakRequestListeners = params.breakRequestListeners;
    this.invokedModules = params.invokedModules;
};


// Request a break
//
// BreakRequestedListeners will be notified.
State.prototype.requestBreak = function() {
    this.breakRequested = true;
    for (var i = 0; i < this.breakRequestedListeners.length; i++ ) {
	try {
	    this.breakRequestedListeners[i]();
	} catch(e) {
	    helpers.reportError(e);
	}
    }
};


State.prototype.addBreakRequestedListener = function(listener) {
    this.breakRequestedListeners.push(listener);
};



State.prototype.removeBreakRequestedListener = function(listener) {
    for (var i = this.breakRequestedListeners.length - 1 ; i >= 0; i--) {
	if (this.breakRequestedListeners[i] === listener) {
	    this.breakRequestedListeners.splice(i, 1);
	}
    }
};




// Add the following form to the control stack.
State.prototype.pushControl = function(aForm) {
    this.cstack.push(aForm);
};


// Add several forms to the control stack in reverse order.
State.prototype.pushManyControls = function(forms) {
    for (var i = 0; i < forms.length; i++) {
	this.cstack.push(forms[forms.length-1-i]);
    }
};


// Returns true if the machine is in a stuck state.
State.prototype.isStuck = function() {
    return this.cstack.length === 0;
};

// Pop the last pushed form.
State.prototype.popControl = function() {
    if (this.cstack.length === 0) {
	throw types.internalError("cstack empty", captureCurrentContinuationMarks(this));
    }
    return this.cstack.pop();
};


// Push a value.
State.prototype.pushValue = function(aVal) {
    debugF(function(){ return "pushValue" + sys.inspect(aVal); } );
    this.vstack.push(aVal);
};


// Pop a value.
State.prototype.popValue = function() {
    debugF(function(){ return "popValue" });
    if (this.vstack.length === 0) {
 	throw types.internalError("vstack empty", captureCurrentContinuationMarks(this));
    }
    return this.vstack.pop();
};

// Push n undefined values onto the stack.
State.prototype.pushn = function(n) {
    debugF(function(){ return "PUSHN " + n } );
    for (var i = 0; i < n; i++) {
	this.vstack.push(types.UNDEFINED);
    }
};

// Pop n values from the stack.
State.prototype.popn = function(n) {
  debugF(function(){ return "POPN " + n } );
  var returnedValues = [];
  for (var i = 0; i < n; i++) {
    if (this.vstack.length === 0) {
        throw types.internalError("vstack empty", captureCurrentContinuationMarks(this));
    }
    returnedValues.push(this.vstack.pop());
  }
 return returnedValues;
};


// Peek at the nth value on the stack.
State.prototype.peekn = function(depth) {
    if (this.vstack.length - 1 - (depth || 0) < 0) {
	throw types.internalError("vstack not long enough", captureCurrentContinuationMarks(this));
    }
    return this.vstack[this.vstack.length - 1 - (depth || 0)];
};

// Set the nth value on the stack.
State.prototype.setn = function(depth, v) {
    this.vstack[this.vstack.length - 1 - (depth || 0)] = v;
};


// Reference an element of a prefix on the value stack.
State.prototype.refPrefix = function(depth, pos, srcloc) {
    var value = this.vstack[this.vstack.length-1 - depth].ref(pos, srcloc);
    if (value instanceof types.ModuleVariableRecord) {
    	if (this.invokedModules[value.resolvedModuleName]) {
    	    var moduleRecord =  this.invokedModules[value.resolvedModuleName];
    	    if (typeof(moduleRecord.providedValues[value.variableName]) !== 'undefined') {
    		    return moduleRecord.providedValues[value.variableName];
    	    }
    	   throw types.schemeError(
    		types.exnFailContractVariable(
    		    "reference to an identifier before its definition: " +
    			value.variableName,
    		    false,
    		    value.variableName)); 
    	}
    }
    return value;
};


// Set an element of a prefix on the value stack.
State.prototype.setPrefix = function(depth, pos, v) {
    debug("setPrefix");
    this.vstack[this.vstack.length - 1 - depth].set(pos, v);
};




State.prototype.setPrintHook = function(printHook) {
    this.hooks['printHook'] = printHook;
};


State.prototype.getPrintHook = function() {
    return this.hooks['printHook'];
};


State.prototype.setDisplayHook = function(printHook) {
    this.hooks['displayHook'] = printHook;
};

State.prototype.setImageProxyHook = function(imageProxyHook) {
    this.hooks['imageProxyHook'] = imageProxyHook;
};

State.prototype.getImageProxyHook = function() {
    return this.hooks['imageProxyHook'];
};


State.prototype.getDisplayHook = function() {
    return this.hooks['displayHook'];
};


State.prototype.getToplevelNodeHook = function() {
    return this.hooks['toplevelNodeHook'];
};


State.prototype.setToplevelNodeHook = function(hook) {
    this.hooks['toplevelNodeHook'] = hook;
};




// Captures the current continuation marks in the state.
// Helper function
var captureCurrentContinuationMarks = function(state) {
    var dict = types.makeLowLevelEqHash();
    for (var i = 0; i < state.cstack.length; i++) {
      if ( types.isContMarkRecordControl(state.cstack[i]) ) {
          var aDict = state.cstack[i].dict;
    /*	    var keys = aDict.keys();
          for (var j = 0; j < keys.length; j++) {
            dict.put(keys[j], (dict.get(keys[j]) || []) );
            dict.get(keys[j]).push(aDict.get(keys[j]) );
          }
     */
          // copy the JS hashtable into a lowLevelEqHash
          for(var key in aDict) {
            dict.put(key, [aDict[key]] || []);
            dict.get(key).push(aDict[key]);
          }
      }
    }
    return types.continuationMarkSet(dict);
};




var STACK_KEY = "moby-stack-record-continuation-mark-key";

var getStackTraceFromContinuationMarks = function(contMarkSet) {
    var results = [];
    var stackTrace = contMarkSet.ref(STACK_KEY);
    // KLUDGE: the first element in the stack trace
    // can be weird print-values may introduce a duplicate
    // location.
    for (var i = stackTrace.length - 1; 
	 i >= 0; i--) {
	var callRecord = stackTrace[i];
	var id = callRecord.ref(0);
	var offset = callRecord.ref(1);
	var line = callRecord.ref(2);
	var column = callRecord.ref(3);
	var span = callRecord.ref(4);
	var newHash = {'id': id, 
		       'offset': offset,
		       'line': line, 
		       'column': column,
		       'span': span};
	if (results.length === 0 ||
	    (! isEqualHash(results[results.length-1],
			   newHash))) {
	    results.push(newHash);
	}
    }
    return results;
};



var isEqualHash = function(hash1, hash2) {
    for (var key in hash1) {
	if (hasOwnProperty.call(hash1, key)) {
	    if (hasOwnProperty.call(hash2, key)) {
		if (hash1[key] !== hash2[key]) {
		    return false;
		}
	    } else {
		return false;
	    }
	}
    }
    for (var key in hash2) {
	if (hasOwnProperty.call(hash2, key)) {
	    if (hasOwnProperty.call(hash1, key)) {
		if (hash1[key] !== hash2[key]) {
		    return false;
		}
	    } else {
		return false;
	    }
	}
    }
    return true;
};







state.State = State;
state.isState = isState;
state.captureCurrentContinuationMarks = captureCurrentContinuationMarks;
state.getStackTraceFromContinuationMarks = getStackTraceFromContinuationMarks;


})();
