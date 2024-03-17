/*
// For node.js.
var sys = require('sys');
var types = require('./types');
var primitive = require('./primitive');
var loader = require('./loader');
var assert = require('assert');
var control = require('./control');
var state = require('./state');

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
*/


//////////////////////////////////////////////////////////////////////







//////////////////////////////////////////////////////////////////////

var interpret = {};


(function() {

// load: compilationTop state? -> state
// Load up the bytecode into a state, ready for evaluation.  If
// an old state is given, then reuses it.  In particular, if the
// compilationTop uses global variables, we try to preserve the
// values of old globals.
var load = function(compilationTop, aState) {
    if (! aState) { aState = new state.State(); }

    try {
      // Install the indirects table.
      processIndirects(aState, compilationTop['compiled-indirects']);

      // Process the prefix.
      var prefix = loader.loadPrefix(compilationTop.prefix);
      control.processPrefix(aState, prefix);


      // Add the code form to the control stack.
      aState.pushControl(loader.loadCode(aState, compilationTop.code));
    } catch(e) {
      if (types.isSchemeError(e)) {
          // scheme exception
          if ( types.isExn(e.val) &&
              !types.isContinuationMarkSet( types.exnContMarks(e.val) ) ) {
            types.exnSetContMarks(e.val,
                                  state.captureCurrentContinuationMarks(aState));
          }
      }
      throw e;
    }

    return aState;

    // TODO: do some processing of the bytecode so that all the
    // constants are native, enable quick dispatching based on
    // bytecode type, rewrite the indirect loops, etc...
};




var processIndirects = function(state, indirects) {
    // First, install the shells
    for (var i = 0 ;i < indirects.length; i++) {
	var anIndirect = indirects[i];
	var lam = anIndirect['lam'];

	var numParams = lam['num-params'];
	var paramTypes = lam['param-types'];
	var isRest = lam['rest?'];
	var closureVals = makeClosureValsFromMap(state,
						 lam['closure-map'], 
						 lam['closure-types']);

	// Subtle: ignore the lam['body'] here: first install the lambdas in the heap.
	var sentinelBody = new control.ConstantControl(false)

	state.heap[anIndirect.id] = 
	    new types.ClosureValue(anIndirect.id,
				   numParams, 
				   paramTypes, 
				   isRest, 
				   closureVals, 
				   sentinelBody);
    }

    // Once the lambdas are there, we can load up the bodies.
    for (var i = 0 ;i < indirects.length; i++) {
      var anIndirect = indirects[i];
      var lam = anIndirect['lam'];

      var lamValue = state.heap[anIndirect.id];
      lamValue.body = loader.loadCode(state, lam['body'])
    }
};








// makeClosureValsFromMap: state [number ...] -> [scheme-value ...]
// Builds the array of closure values, given the closure map and its
// types.
var makeClosureValsFromMap = function(state, closureMap, closureTypes) {
    var closureVals = [];
    for (var i = 0; i < closureMap.length; i++) {
      var val, type;
      val = state.peekn(closureMap[i]);
      type = closureTypes[i];
      // FIXME: look at the type; will be significant?
      closureVals.push(val);
    }
    return closureVals;
};


// We bounce every so often to allow UI events to process.
var MAX_STEPS_BEFORE_BOUNCE = 50000;


// run: state (scheme-value -> void) (exn -> void) -> void
var run = function(aState, onSuccessK, onFailK) {
    if (! onSuccessK) { onSuccessK = function(lastResult) {} };
    if (! onFailK) { onFailK = function(exn) { throw exn; } };

    function doRunWork(){
      var gas = MAX_STEPS_BEFORE_BOUNCE;
      while( (! aState.isStuck()) && (gas > 0)) {
          step(aState);
          gas--;
      }
      if (aState.breakRequested) {
          onFailK(types.schemeError(
                    types.exnBreak("user break", 
                                   state.captureCurrentContinuationMarks(aState),
                                   captureContinuationClosure(aState))));
          return;
      } else if (gas <= 0) {
          var stateValues = aState.save();
          setTimeout(function(){ 
                       aState.restore(stateValues);
                       run(aState, onSuccessK, onFailK);
                     },
                     0);
      } else {
          onSuccessK(aState.v);
          return;
      }
    }
 
    try { doRunWork();
    } catch (e) {
      if (e instanceof control.PauseException) {
          var onRestart = makeOnRestart(aState, onSuccessK, onFailK);
          var onCall = makeOnCall(aState);
          e.onPause(onRestart, onCall);
          return;
      } else if (types.isSchemeError(e)) {
          // scheme exception
          // If the error is incomplete, finish constructing it
          if ( types.isIncompleteExn(e.val) ) {
        var contMarks = state.captureCurrentContinuationMarks(aState);
          e = types.schemeError(e.val.constructor.apply(null, [e.val.msg, contMarks].concat(e.val.otherArgs) ));
          }
          onFailK(e);
          return;
      } else {
          onFailK(e);
          return;
      }
    }
};

    

// call: state scheme-procedure (arrayof scheme-values) (scheme-value -> void) -> void
var call = function(state, operator, operands, k, onFail) {
    var stateValues = state.save();
    state.clearForEval({preserveBreak: true});

    state.pushControl(
      new control.ApplicationControl(
          new control.ConstantControl(operator), 
          helpers.map(function(op) {
              return new control.ConstantControl(op)},
          operands)));
    try {
      run(state,
          function(v)   { state.restore(stateValues); k(v) },
          function(exn) { state.restore(stateValues); onFail(exn); }
          );
    } catch (e) {
      state.restore(stateValues);
      throw e;
    }
};


var makeOnCall = function(state) {
    return function(operator, operands, k, onFail) {
	return call(state, operator, operands, k, onFail);
    };
};





// create function for restarting a run, given the state and the
// continuation k.
var makeOnRestart = function(aState, onSuccessK, onFailK) {
    var stateValues = aState.save();
    aState.clearForEval({preserveBreak: true});
    return function(v) {
      aState.restore(stateValues);
      if ( types.isSchemeError(v) ) {
          // on a scheme scheme exception, install the marks
          if ( types.isIncompleteExn(v.val) ) {
        var contMarks = state.captureCurrentContinuationMarks(aState);
        v = types.schemeError(
          v.val.constructor.apply(null, [v.val.msg, contMarks].concat(v.val.otherArgs) ));
          }

          onFailK(v);
      } else if ( types.isInternalError(v) ) {
          onFailK(v);
      } else {
          aState.v = v;
          run(aState, onSuccessK, onFailK);
      }
    }
};
    


// step: state -> void
// Takes one step in the abstract machine.
var step = function(aState) {
    var nextCode = aState.popControl();
    debugF(function() { return sys.inspect(nextCode) });
    if (nextCode['invoke']) {
      nextCode.invoke(aState);
    } else {
      // we should never get here.
      throw types.internalError("I don't know how to handle " + sys.inspect(nextCode),
              state.captureCurrentContinuationMarks(aState));
    }
};



//////////////////////////////////////////////////////////////////////



primitive.addPrimitive('call/cc', 
		       new primitive.Primitive('call/cc',
					       1,
					       false, true,
					       function(state, f) {
						   var continuationClosure = 
						       captureContinuationClosure(state);
						   state.pushValue(continuationClosure);
						   state.v = f;
						   state.pushControl(new control.CallControl(1));
					       }));


var captureContinuationClosure = function(state) {
    return new types.ContinuationClosureValue(state.vstack,
					      state.cstack);
};



//////////////////////////////////////////////////////////////////////


interpret.load = load;
interpret.step = step;
interpret.run = run;
interpret.call = call;
//interpret.setDebug = setDebug;

})();

