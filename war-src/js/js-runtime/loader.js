// Loader: take bytecode and translate to internal format.
/*
var control = require('./control');
var sys = require('sys');
*/

var loader = {};

(function() {



// loadCode: State code -> Control
var loadCode = function(aState, nextCode) {
    switch(nextCode.$) {
    case 'mod':
	return loadMod(aState, nextCode);
	break;
    case 'def-values':
	return loadDefValues(aState, nextCode);
	break;
    case 'indirect':
	return loadIndirect(aState, nextCode);
	break;
    case 'apply-values':
	return loadApplyValues(aState, nextCode);
	break;
    case 'toplevel':
	return loadToplevel(aState, nextCode);
	break;
    case 'constant':
	return loadConstant(aState, nextCode);
	break;
    case 'req':
	return loadReq(aState, nextCode);
	break;
    case 'seq':
	return loadSeq(aState, nextCode);
	break;
    case 'application':
	return loadApplication(aState, nextCode);
	break;
    case 'localref':
	return loadLocalRef(aState, nextCode);
	break;
    case 'primval':
	return loadPrimval(aState, nextCode);
	break;
    case 'branch':
	return loadBranch(aState, nextCode);
	break;
    case 'lam':
	return loadLam(aState, nextCode);
	break;
    case 'let-one':
	return loadLetOne(aState, nextCode);
	break;
    case 'let-void':
	return loadLetVoid(aState, nextCode);
	break;
    case 'beg0':
	return loadBeg0(aState, nextCode);
	break;
    case 'boxenv':
	return loadBoxenv(aState, nextCode);
	break;
    case 'install-value':
	return loadInstallValue(aState, nextCode);
	break;
    case 'with-cont-mark':
	return loadWithContMark(aState, nextCode);
	break;
    case 'assign':
	return loadAssign(aState, nextCode);
	break;
    case 'varref':
	return loadVarref(aState, nextCode);
	break;
    case 'closure':
	return loadClosure(aState, nextCode);
	break;
    case 'case-lam':
	return loadCaseLam(aState, nextCode);
	break;
    case 'let-rec':
	return loadLetRec(aState, nextCode);
	break;
    default:
	// FIXME: as soon as we implement topsyntax,
	// we should never get here.
	throw types.internalError("I don't know how to handle " + sys.inspect(nextCode),
				  state.captureCurrentContinuationMarks(aState));
    }
};



// loadCodes: state [code] -> [Control]
var loadCodes = function(state, codes) {
    var result = [];
    for (var i = 0; i < codes.length; i++) {
      result.push(loadCode(state, codes[i]));
    }
    return result;
};



//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////


var loadMod = function(state, modCode) {
    return new control.ModControl(loadPrefix(modCode['prefix']),
				  loadCodes(state, modCode['body']));
};


var loadPrefix = function(aPrefix) {
    return new control.Prefix({numLifts : aPrefix['num-lifts'],
			       toplevels: aPrefix['toplevels']});
};


var loadDefValues = function(state, nextCode) {
    return new control.DefValuesControl(nextCode['ids'],
					loadCode(state, nextCode['body']));
};


var loadIndirect = function(state, nextCode) {
    return new control.ConstantControl(state.heap[nextCode['value']]);
};


var loadApplyValues = function(state, nextCode) {
    return new control.ApplyValuesControl(
	loadCode(state, nextCode['proc']),
	loadCode(state, nextCode['args-expr']));
};

var loadToplevel = function(state, nextCode) {
    return new control.ToplevelControl(nextCode['depth'],
				       nextCode['pos'],
				       nextCode['loc']);
    // FIXME: use isConst and isReady
    //    isConst: nextCode['const?']
    //    isReady: nextCode['ready?'];
};


var loadConstant = function(state, nextCode) {
    return new control.ConstantControl(nextCode['value']);
};


var loadReq = function(state, nextCode) {
    return new control.RequireControl(nextCode['reqs'] + '');
};

var loadSeq = function(state, nextCode) {
    var result = new control.SeqControl(loadCodes(state, nextCode['forms']));
    return result;
};

var loadApplication = function(state, nextCode) {
    return new control.ApplicationControl(
	loadCode(state, nextCode['rator']),
	loadCodes(state, nextCode['rands']));
};

var loadLocalRef = function(state, nextCode) {
    return new control.LocalrefControl(
	nextCode['pos'],
	nextCode['unbox?']);

    // FIXME: use the other attributes:
    // 	nextCode['clear'],
    // 	nextCode['other-clears?'],
    // 	nextCode['flonum?'];
};

var loadPrimval = function(state, nextCode) {
    return new control.PrimvalControl(nextCode['value']);
};

var loadBranch = function(state, nextCode) {
    return new control.BranchControl(loadCode(state, nextCode['test']),
				     loadCode(state, nextCode['then']),
				     loadCode(state, nextCode['else']));
};


var loadLam = function(state, nextCode) {
    var result =  new control.LamControl(
	{ name: nextCode['name'],
          locs: nextCode['locs'],
	  numParams: nextCode['num-params'],
	  paramTypes: nextCode['param-types'],
	  isRest: nextCode['rest?'],
	  closureMap: nextCode['closure-map'],
	  closureTypes: nextCode['closure-types'],
	  body: loadCode(state, nextCode['body']) 
	});
    return result;
    // FIXME: use nextCode['flags'],
    //            nextCode['max-let-depth'],
};


var loadLetOne = function(state, nextCode) {
    return new control.LetOneControl(
	loadCode(state, nextCode['rhs']),
	loadCode(state, nextCode['body']));
    // FIXME: use nextCode['flonum?']
};


var loadLetVoid = function(state, nextCode) {
    return new control.LetVoidControl({count: nextCode['count'],
				       isBoxes: nextCode['boxes?'],
				       body: loadCode(state, nextCode['body'])});
};

var loadBeg0 = function(state, nextCode) {
    return new control.Beg0Control(
	loadCodes(state, nextCode['seq']));
};

var loadBoxenv = function(state, nextCode) {
    return new control.BoxenvControl(
	nextCode['pos'],
	loadCode(state, nextCode['body']));
};



var loadInstallValue = function(state, nextCode) {
    return new control.InstallValueControl(
	{ count: nextCode['count'],
	  pos: nextCode['pos'],
	  isBoxes: nextCode['boxes?'],
	  rhs: loadCode(state, nextCode['rhs']),
	  body: loadCode(state, nextCode['body'] )});
};

var loadWithContMark = function(state, nextCode) {
    return new control.WithContMarkControl(
	loadCode(state, nextCode['key']),
	loadCode(state, nextCode['val']),
	loadCode(state, nextCode['body']));
};


var loadAssign = function(state, nextCode) {
    return new control.AssignControl(
	{ id: loadCode(state, nextCode['id']),
	  rhs: loadCode(state, nextCode['rhs']),
	  isUndefOk: nextCode['undef-ok?'] });
};


var loadVarref = function(state, nextCode) {
    return new control.VarrefControl(
	loadCode(state, nextCode['toplevel']));
};

var loadClosure = function(state, nextCode) {
    return new control.ClosureCommand(nextCode['gen-id']);
    // FIXME: use nextCode['lam']?
};


var loadCaseLam = function(state, nextCode) {
    return new control.CaseLamControl(nextCode['name'],
				      loadCodes(state, nextCode['clauses']));
};


var loadLetRec = function(state, nextCode) {
    return new control.LetRecControl(loadCodes(state, nextCode['procs']),
				     loadCode(state, nextCode['body']));
};



//////////////////////////////////////////////////////////////////////


loader.loadCode = loadCode;

loader.loadPrefix = loadPrefix;
})();

