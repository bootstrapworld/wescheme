///////////////////////////////////////////////////////////////////////

// Node.js runtime

var runtime = {};

runtime.control = control;
runtime.interpret = interpret;
runtime.jsnums = jsnums;
runtime.loader = loader;
runtime.primitive = primitive;
runtime.state = state;
runtime.types = types;


runtime.State = state.State;
runtime.Prefix = interpret.Prefix;
runtime.VariableReference = types.VariableReference;
runtime.ContMarkRecordControl = interpret.ContMarkRecordControl;
runtime.load = interpret.load;
runtime.step = interpret.step;
runtime.run = interpret.run;

runtime.setDebug = interpret.setDebug;



runtime.symbol = types.symbol;
runtime.keyword = types.keyword;
runtime.rational = types.rational;
runtime['float'] = types['float'];
runtime.complex = types.complex;
runtime.pair = types.pair;
runtime.list = types.list;
runtime.vector = types.vector;
runtime.regexp = types.regexp;
runtime.byteRegexp = types.byteRegexp;
runtime['char'] = types['char'];
runtime['string'] = types['string'];
runtime.box = types.box;
runtime.boxImmutable = types.boxImmutable;
runtime.path = types.path;
runtime.bytes = types.bytes;
runtime.hash = types.hash;
runtime.hashEq = types.hashEq;
runtime.posn = types.posn;
runtime.arityAtLeast = types.arityAtLeast;
runtime.color = types.color;


runtime.isNumber = types.isNumber;
runtime.isSymbol = types.isSymbol;
runtime.isChar = types.isChar;
runtime.isString = types.isString;
runtime.isCons = types.isCons;
runtime.isVector = types.isVector;
runtime.isBox = types.isBox;
runtime.isHash = types.isHash;
runtime.isStrct = types.isStruct;
runtime.isPosn = types.isPosn;
runtime.isArityAtLeast = types.isArityAtLeast;
runtime.isByteString = types.isByteString;


runtime.FALSE = Logic.FALSE;
runtime.TRUE = Logic.TRUE;


runtime.UNDEFINED = types.UNDEFINED;
runtime.VOID = types.VOID;
runtime.ValuesWrapper = types.ValuesWrapper;
runtime.Box = types.Box;
runtime.EMPTY = types.EMPTY;
//runtime.Str = types.Str;

runtime.ClosureValue = types.ClosureValue;
runtime.Primitive = primitive.Primitive;

runtime.lessThanOrEqual = jsnums.lessThanOrEqual;

runtime.exn = types.exn;
runtime.isExn = types.isExn;
runtime.exnMessage = types.exnMessage;
runtime.exnContMarks = types.exnContMarks;
runtime.exnFail = types.exnFail;
runtime.isExnFail = types.isExnFail;
runtime.exnFailContract = types.exnFailContract;
runtime.isExnFailContract = types.isExnFailContract;
