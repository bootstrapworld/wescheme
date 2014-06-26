// if not defined, declare the compiler object as part of plt
if(typeof(plt) === "undefined")          plt = {};
if(typeof(plt.compiler) === "undefined") plt.compiler = {};


//////////////////////////////////////////////////////////////////////////////
/////////////////// COMMON FUNCTIONS AND STRUCTURES //////////////////////////
//////////////// used by multiple phases of the compiler/////////////////////

var unimplementedException = function(str){
  this.str = str;
}

/**************************************************************************
 *
 *    CONVERT LOCAL COMPILER ERRORS INTO WESCHEME ERRORS
 *
 **************************************************************************/
// encode the msg and location as a JSON error
function throwError(msg, loc, errorClass) {
  loc.source = loc.source || "<unknown>"; // FIXME -- we should have the source populated
  // rewrite a ColoredPart to match the format expected by the runtime
  function rewritePart(part){
    if(typeof(part) === 'string'){
      return part;
    } else if(part instanceof symbolExpr){
      return '["span", [["class", "SchemeValue-Symbol"]], '+part.val+']';
      return part.val;
    } else if(part.location !== undefined){
      return {text: part.text, type: 'ColoredPart', loc: part.location.toJSON()
            , toString: function(){return part.text;}};
    } else if(part.locations !== undefined){
      return {text: part.text, type: 'MultiPart', solid: part.solid
            , locs: part.locations.map(function(l){return l.toJSON()})
            , toString: function(){return part.text;}};
    }
  }
  
  msg.args = msg.args.map(rewritePart);
  
  var json = {type: "moby-failure"
    , "dom-message": ["span"
                      ,[["class", "Error"]]
                      ,["span"
                        , [["class", (errorClass || "Message")]]].concat(
                         (errorClass? [["span"
                                        , [["class", "Error.reason"]]
                                        , msg.toString()]
                                      , ["span", [["class", ((errorClass || "message")
                                                            +((errorClass === "Error-GenericReadError")?
                                                              ".locations"
                                                              :".otherLocations"))]]]]
                                      : msg.args.map(function(x){return x.toString();})))
                      ,["br", [], ""]
                      ,["span"
                        , [["class", "Error.location"]]
                        , ["span"
                           , [["class", "location-reference"]
                              , ["style", "display:none"]]
                           , ["span", [["class", "location-offset"]], (loc.offset+1).toString()]
                           , ["span", [["class", "location-line"]]  , loc.sLine.toString()]
                           , ["span", [["class", "location-column"]], loc.sCol.toString()]
                           , ["span", [["class", "location-span"]]  , loc.span.toString()]
                           , ["span", [["class", "location-id"]]    , loc.source.toString()]
                           ]
                        ]
                      ]
    , "structured-error": JSON.stringify({message: (errorClass? false : msg.args), location: loc.toJSON() })
  };
  throw JSON.stringify(json);
}


// checkDuplicateIdentifiers : [listof SymbolExprs], Program -> Void
// sort the array, and throw errors for non-symbols, keywords or duplicates
function checkDuplicateIdentifiers(lst, stx, loc){
  var sorted_arr = lst.sort();
  var results = [];
  for (var i = 0; i < lst.length; i++) {
    if(!(sorted_arr[i] instanceof symbolExpr)){
      throwError("expected identifier "+sorted_arr[i].val, sorted_arr[i].location);
//    } else if(plt.compiler.keywords.indexOf(sorted_arr[i].val)>-1){
//      throwError(new types.Message([new types.ColoredPart(sorted_arr[i].val, sorted_arr[i].location),
//                                " : this is a reserved keyword and cannot be used as a variable or function name"])
//                 , sorted_arr[i].location);
    } else if(results.indexOf(sorted_arr[i].toString()) > -1) {
      throwError(new types.Message([new types.ColoredPart(stx.toString(), stx.location),
                                ": found ",
                                new types.ColoredPart("a variable", sorted_arr[i].location),
                                " that is already used ",
                                new types.ColoredPart("here", sorted_arr[i-1].location)])
                 , sorted_arr[i].location);
    } else {
      results.push(sorted_arr[i].toString());
    }
  }
}

// couples = pair
function couple(first, second) {
  this.first = first;
  this.second = second;
  this.toString = function(){
    return "("+this.first.toString() +" "+this.second.toString()+")";
  };
};
function coupleFirst(x) { return x.first; };
function coupleSecond(x) { return x.second; };

/**************************************************************************
 *
 *    AST Nodes
 *
 **************************************************************************/

// Inheritance from pg 168: Javascript, the Definitive Guide.
var heir = function(p) {
  var f = function() {};
  f.prototype = p;
  return new f();
};

// all Programs, by default, print out their values and have no location
// anything that behaves differently must provide their own toString() function
var Program = function() {
  // -> String
  this.toString = function(){ return this.val.toString(); };
};

// Function definition
function defFunc(name, args, body, stx) {
  Program.call(this);
  this.name = name;
  this.args = args;
  this.body = body;
  this.stx  = stx;
  this.toString = function(){
    return "(define ("+this.name.toString()+" "+this.args.join(" ")+")\n    "+this.body.toString()+")";
  };
};
defFunc.prototype = heir(Program.prototype);


// Variable definition
function defVar(name, expr, stx) {
  Program.call(this);
  this.name = name;
  this.expr = expr;
  this.stx  = stx;
  this.toString = function(){
    return "(define "+this.name.toString()+" "+this.expr.toString()+")";
  };
};
defVar.prototype = heir(Program.prototype);

// Multi-Variable definition
function defVars(names, expr, stx) {
  Program.call(this);
  this.names  = names;
  this.expr   = expr;
  this.stx    = stx;
  this.toString = function(){
    return "(define-values ("+this.names.join(" ")+") "+this.expr.toString()+")";
  };
};
defVars.prototype = heir(Program.prototype);

// Structure definition
function defStruct(name, fields, stx) {
  Program.call(this);
  this.name   = name;
  this.fields = fields;
  this.stx    = stx;
  this.toString = function(){
    return "(define-struct "+this.name.toString()+" ("+this.fields.toString()+"))";
  };
};
defStruct.prototype = heir(Program.prototype);

// Begin expression
function beginExpr(exprs, stx) {
  Program.call(this);
  this.exprs  = exprs;
  this.stx    = stx;
  this.toString = function(){
    return "(begin "+this.exprs.join(" ")+")";
  };
};
beginExpr.prototype = heir(Program.prototype);

// Lambda expression
function lambdaExpr(args, body, stx) {
  Program.call(this);
  this.args = args;
  this.body = body;
  this.stx  = stx;
  this.toString = function(){
    return "(lambda ("+this.args.join(" ")+") "+this.body.toString()+")";
  };
};
lambdaExpr.prototype = heir(Program.prototype);

// Local expression
function localExpr(defs, body, stx) {
  Program.call(this);
  this.defs = defs;
  this.body = body;
  this.stx  = stx;
  this.toString = function(){
    return "(local ("+this.defs.toString()+") ("+this.body.toString()+"))";
  };
};
localExpr.prototype = heir(Program.prototype);

// Letrec expression
function letrecExpr(bindings, body, stx) {
  this.bindings = bindings;
  this.body     = body;
  this.stx      = stx;
  this.toString = function(){
    return "(letrec ("+this.bindings.toString()+") ("+this.body.toString()+"))";
  };
};

// Let expression
function letExpr(bindings, body, stx) {
  this.bindings = bindings;
  this.body     = body;
  this.stx      = stx;
  this.toString = function(){
    return "(let ("+this.bindings.toString()+") ("+this.body.toString()+"))";
  };
};

// Let* expressions
function letStarExpr(bindings, body, stx) {
  this.bindings = bindings;
  this.body     = body;
  this.stx      = stx;
  this.toString = function(){
    return "(let* ("+this.bindings.toString()+") ("+this.body.toString()+"))";
  };
};

// cond expression
function condExpr(clauses, stx) {
  this.clauses  = clauses;
  this.stx      = stx;
  this.toString = function(){
    return "(cond\n    "+this.clauses.join("\n    ")+")";
  };
};

// Case expression
function caseExpr(expr, clauses, stx) {
  Program.call(this);
  this.expr     = expr;
  this.clauses  = clauses;
  this.stx      = stx;
  this.toString = function(){
    return "(case "+this.expr.toString()+"\n    "+this.clauses.join("\n    ")+")";
  };
};
caseExpr.prototype = heir(Program.prototype);

// and expression
function andExpr(exprs, stx) {
  this.exprs  = exprs;
  this.stx    = stx;
  this.toString = function(){ return "(and "+this.exprs.join(" ")+")"; };
};

// or expression
function orExpr(exprs, stx) {
  this.exprs  = exprs;
  this.stx    = stx;
  this.toString = function(){ return "(or "+this.exprs.toString()+")"; };
};

// application expression
function callExpr(func, args, stx) {
  Program.call(this);
  this.func   = func;
  this.args   = args;
  this.stx    = stx;
  this.toString = function(){
    return "("+[this.func].concat(this.args).join(" ")+")";
  };
};
callExpr.prototype = heir(Program.prototype);

// if expression
function ifExpr(predicate, consequence, alternative, stx) {
  Program.call(this);
  this.predicate = predicate;
  this.consequence = consequence;
  this.alternative = alternative;
  this.stx = stx;
  this.toString = function(){
    return "(if "+this.predicate.toString()+" "+this.consequence.toString()+" "+this.alternative.toString()+")";
  };
};
ifExpr.prototype = heir(Program.prototype);

// symbol expression (ID)
function symbolExpr(val) {
  Program.call(this);
  this.val = val;
};
symbolExpr.prototype = heir(Program.prototype);

// number expression
function numberExpr(val) {
  Program.call(this);
  this.val = val;
};
numberExpr.prototype = heir(Program.prototype);

// string expression
function stringExpr(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){ return "\""+this.val.toString()+"\""; };
};
stringExpr.prototype = heir(Program.prototype);

// vector expression
function vectorExpr(vals, size) {
  Program.call(this);
  this.vals = vals;
  this.size = size;
  this.toString = function(){
    var strVals = this.vals.map(function(v){return v.toString();});
    return "#("+strVals.join(" ")+")" ;
  };
};
vectorExpr.prototype = heir(Program.prototype);

// char expression
function charExpr(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){ return "#\\"+this.val.toString(); };
};
charExpr.prototype = heir(Program.prototype);

// list expression
function listExpr(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){ return "(list "+this.val.toString() + ")"; };
};
listExpr.prototype = heir(Program.prototype);

// quoted expression
function quotedExpr(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){
    if(this.val instanceof Array) return "'("+this.val.toString()+")";
    else return "'"+this.val.toString();
  };
};
quotedExpr.prototype = heir(Program.prototype);

// unquoted expression
function unquotedExpr(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){ return ","+this.val.toString(); };
};
unquotedExpr.prototype = heir(Program.prototype);

// quasiquoted expression
function quasiquotedExpr(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){
    if(this.val instanceof Array) return "`("+this.val.toString()+")";
    else return "`"+this.val.toString();
  };
};
quasiquotedExpr.prototype = heir(Program.prototype);

// unquote-splicing
function unquoteSplice(val) {
  Program.call(this);
  this.val = val;
  this.toString = function(){ return ",@"+this.val.toString();};
};
unquoteSplice.prototype = heir(Program.prototype);

// primop expression
function primop(val) {
  Program.call(this);
  this.val = val;
};
primop.prototype = heir(Program.prototype);

// require expression
function requireExpr(spec, stx) {
  Program.call(this);
  this.spec = spec;
  this.stx  = stx;
  this.toString = function(){ return "(require "+this.spec.toString()+")"; };
};
requireExpr.prototype = heir(Program.prototype);

// provide expression
function provideStatement(clauses, stx) {
  Program.call(this);
  this.clauses  = clauses;
  this.stx      = stx;
  this.toString = function(){ return "(provide "+this.clauses.toString()+")" };
};
provideStatement.prototype = heir(Program.prototype);

// Unsupported structure (allows us to generate parser errors ahead of "unsupported" errors)
function unsupportedExpr(val, errorMsg, errorSpan) {
  Program.call(this);
  this.val = val;
  this.errorMsg = errorMsg;
  this.errorSpan = errorSpan; // when throwing an error, we use a different span from the actual sexp span
  this.toString = function(){ return this.val.toString() };
};
unsupportedExpr.prototype = heir(Program.prototype);


/**************************************************************************
 *
 *    STRUCTURES NEEDED BY THE COMPILER
 *
 **************************************************************************/

// bindingConstant: records an id and its associated Java implementation.
function bindingConstant(name, moduleSource, permissions, loc){
  this.name = name;
  this.moduleSource = moduleSource;
  this.permissions = permissions;
  this.loc = loc;
  this.toString = function(){return this.name;};
  return this;
}

// bindingFunction: try to record more information about the toplevel-bound function
function bindingFunction(name, moduleSource, minArity, isVarArity, permissions, isCps, loc){
  this.name = name;
  this.moduleSource = moduleSource;
  this.minArity = minArity;
  this.isVarArity = isVarArity;
  this.permissions = permissions;
  this.isCps = isCps;
  this.loc = loc;
  this.toString = function(){return this.name;};
  return this;
}

// bindingStructue: A binding to a structure.
// bindingStructue : symbol, ?, (listof symbol), symbol, symbol, (listof symbol) (listof symbol) (listof permission), location -> Binding
function bindingStructure(name, moduleSource, fields, constructor,
                          predicate, accessors, mutators, permissions, loc){
  this.name = name;
  this.moduleSource = moduleSource;
  this.fields = fields;
  this.constructor = constructor;
  this.predicate = predicate;
  this.accessors = accessors;
  this.mutators = mutators;
  this.permissions = permissions;
  this.loc = loc;
  this.toString = function(){return this.name;};
  return this;
}

// getTopLevelEnv: symbol -> env
function getTopLevelEnv(lang){
  // fixme: use the language to limit what symbols get in the toplevel.
  var baseConstantsEnv = ["null", "empty", "true",//effect:do-nothing
                         , "false", "eof", "pi", "e","js-undefined"
                         , "js-null"].reduce(function(env, id){
                                             return env.extendConstant(id.toString(), "moby/toplevel", false)
                                             }, plt.compiler.emptyEnv());

  // Registers a new toplevel function, munging the name
  var r = function(env, name, arity, vararity){
    return env.extendFunction(name, "moby/toplevel", arity, vararity, false);
    return e;
  };
  
  // core defined symbols
  var coreBindings = [["<", 2, true] // Numerics
                     ,["<=", 2, true]
                     ,["=", 2, true]
                     ,[">", 2, true]
                     ,[">=", 2, true]
                     
                     ,["=~", 3]
                     ,["number->string", 1]
                     ,["even?", 1]
                     ,["odd?", 1]
                     ,["positive?", 1]
                     ,["negative?", 1]
                     ,["number?", 1]
                     ,["rational?", 1]
                     ,["quotient", 2]
                     ,["remainder", 2]
                     ,["numerator", 1]
                     ,["denominator", 1]
                     ,["integer?", 1]
                     ,["real?", 1]
                     ,["abs", 1]
                     ,["acos", 1]
                     ,["add1", 1]
                     ,["angle", 1]
                     ,["asin", 1]
                     ,["atan", 1, true]           // arity is either 1 or 2
                     ,["ceiling", 1]
                     ,["complex?", 1]
                     ,["conjugate", 1]
                     ,["cos", 1]
                     ,["cosh", 1]
                     ,["denominator", 1]
                     ,["even?", 1]
                     ,["exact->inexact", 1]
                     ,["exact?", 1]               // *
                     ,["exp", 1]
                     ,["expt", 2]
                     ,["floor", 1]
                     ,["gcd", 1, true]
                     ,["imag-part", 1]
                     ,["inexact->exact", 1]
                     ,["inexact?", 1]
                     ,["integer->char", 1]
                     ,["integer-sqrt", 1]         // *
                     ,["integer?", 1]
                     ,["lcm", 1, true]
                     ,["log", 1]
                     ,["magnitude", 1]
                     ,["make-polar", 2]           // *
                     ,["make-rectangular", 2]     // *
                     ,["max", 1, true]
                     ,["min", 1, true]
                     ,["modulo", 2]
                     ,["negative?", 1]
                     ,["number?", 1]
                     ,["numerator", 1]
                     ,["odd?", 1]
                     ,["positive?", 1]
                     ,["random", 1]
                     ,["rational?", 1]
                     ,["real-part", 1]
                     ,["real?", 1]
                     ,["round", 1]
                     ,["sgn", 1]
                     ,["sin", 1]
                     ,["sinh", 1]
                     ,["sq", 1]
                     ,["sqr", 1]
                     ,["sqrt", 1]
                     ,["sub1", 1]
                     ,["tan", 1]
                     ,["zero?", 1]
                     
                     ,["+", 0, true]
                     ,["-", 1, true]
                     ,["*", 0, true]
                     ,["/", 1, true]
                     
                     // Logic
                     ,["not", 1]
                     ,["false?", 1]
                     ,["boolean?", 1]
                     ,["boolean=?", 2]
                     
                     // Symbols
                     ,["symbol->string", 1]
                     ,["symbol=?", 2]
                     ,["symbol?", 1]
                     
                     // Lists
                     ,["append", 0, true]
                     ,["assq", 2]                 // *
                     ,["assv", 2]                 // *
                     ,["assoc", 2]                 // *
                     ,["caaar", 1]
                     ,["caadr", 1]
                     ,["caar", 1]
                     ,["cadar", 1]
                     ,["cadddr", 1]
                     ,["caddr", 1]
                     ,["cadr", 1]
                     ,["car", 1]
                     ,["cddar", 1]
                     ,["cdddr", 1]
                     ,["cddr", 1]
                     ,["cdr", 1]
                     ,["cdaar", 1]
                     ,["cdadr", 1]
                     ,["cdar", 1]
                     ,["cons?", 1]
                     ,["list?", 1]
                     ,["cons", 2]
                     ,["empty?", 1]
                     ,["length", 1]
                     ,["list", 0, true]
                     ,["list*", 1, true]
                     ,["list-ref", 2]
                     ,["remove", 2]
                     ,["member", 2]
                     ,["member?", 2]
                     ,["memq", 2]
                     ,["memv", 2]
                     ,["null?", 1]
                     ,["pair?", 1]
                     ,["rest", 1]
                     ,["reverse", 1]
                     ,["first", 1]
                     ,["second", 1]
                     ,["third", 1]
                     ,["fourth", 1]
                     ,["fifth", 1]
                     ,["sixth", 1]
                     ,["seventh", 1]
                     ,["eighth", 1]
                     
                     // We're commenting out the mutation operation on pairs
                     // because they're not supported in ISL/ASL anymore.
                     //;,["set-car! 2]
                     //;,["set-cdr! 2]
                     
                     // Box
                     ,["box", 1]
                     ,["unbox", 1]
                     ,["set-box!", 2]
                     ,["box?", 1]
                     
                     // Posn
                     ,["make-posn", 2]
                     ,["posn-x", 1]
                     ,["posn-y", 1]
                     ,["posn?", 1]
                     
                     // Characters
                     ,["char->integer", 1]
                     ,["char-alphabetic?", 1]
                     ,["char-ci<=?", 2, true]
                     ,["char-ci<?", 2, true]
                     ,["char-ci=?", 2, true]
                     ,["char-ci>=?", 2, true]
                     ,["char-ci>?", 2, true]
                     ,["char-downcase", 1]
                     ,["char-lower-case?", 1]
                     ,["char-numeric?", 1]
                     ,["char-upcase", 1]
                     ,["char-upper-case?", 1]
                     ,["char-whitespace?", 1]
                     ,["char<=?", 2, true]
                     ,["char<?", 2, true]
                     ,["char=?", 2, true]
                     ,["char>=?", 2, true]
                     ,["char>?", 2, true]
                     ,["char?", 1]
                     
                     // Strings
                     ,["format", 1, true]
                     ,["list->string", 1]
                     ,["make-string", 2]
                     ,["replicate", 2]
                     ,["string", 0, true]
                     ,["string->list", 1]
                     ,["string->number", 1]
                     ,["string->symbol", 1]
                     ,["string-alphabetic?", 1]
                     ,["string-append", 0, true]
                     ,["string-ci<=?", 2, true]
                     ,["string-ci<?", 2, true]
                     ,["string-ci=?", 2, true]
                     ,["string-ci>=?", 2, true]
                     ,["string-ci>?", 2, true]
                     ,["string-copy", 1]
                     ,["string-length", 1]
                     ,["string-lower-case?", 1]   // *
                     ,["string-numeric?", 1]      // *
                     ,["string-ref", 2]
                     ,["string-upper-case?", 1]   // *
                     ,["string-whitespace?", 1]   // *
                     ,["string<=?", 2, true]
                     ,["string<?", 2, true]
                     ,["string=?", 2, true]
                     ,["string>=?", 2, true]
                     ,["string>?", 2, true]
                     ,["string?", 1]
                     ,["substring", 3 ]
                     ,["string-ith", 2]
                     ,["int->string", 1]
                     ,["string->int", 1]
                     ,["explode", 1]
                     ,["implode", 1]
                     
                     // Eof
                     ,["eof-object?", 1]
                     
                     // Misc
                     ,["=~", 3]
                     ,["eq?", 2]
                     ,["equal?", 2]
                     ,["equal~?", 3]
                     ,["eqv?", 2]
                     ,["error", 2]
                     
                     ,["identity", 1]
                     ,["struct?", 1]
                     ,["current-seconds", 0]
                     
                     // Higher-Order Functions
                     ,["andmap", 1, true]
                     ,["apply", 2, true]           // *
                     ,["argmax", 2]               // *
                     ,["argmin", 2]               // *
                     ,["build-list", 2]
                     ,["build-string", 2]         // *
                     ,["compose", 0, true]         // *
                     ,["filter", 2]               // *
                     ,["foldl", 2, true]
                     ,["foldr", 2, true]                // *
                     ,["map", 1, true]
                     ,["for-each", 1, true]
                     ,["memf", 2]                 // *
                     ,["ormap", 1, true]                // *
                     ,["procedure?", 1]           // *
                     ,["quicksort", 2]            // *
                     ,["sort", 2]                 // *
                     
                     ,["void", 0, true]
                       
                     // Parsing
                     ,["xml->s-exp", 1]
                     
                     // Vectors
                       
                     ,["build-vector", 2]
                     // FIXME: should only take one or two arguments", not vararity
                     ,["make-vector", 1, true]
                     ,["vector", 0, true]
                     ,["vector-length", 1]
                     ,["vector-ref", 2]
                     ,["vector-set!", 3]
                     ,["vector->list", 1]
                     ,["list->vector", 1]
                     ,["vector?", 1]
                     
                     ,["printf", 1, true]
                     ,["display", 1]
                     ,["write", 1]
                     ,["newline", 0]
                     ,["call/cc", 1]
                     ,["procedure-arity", 1]
                     
                     
                     // Testing functions.
                     // NOTE: the desugar.ss module converts use of check-expect into ones that
                     // thunk its arguments", and pass an additional location argument.
                     ,["check-expect", 2]
                     ,["EXAMPLE", 2]
                     ,["check-within", 3]
                     ,["check-error", 2]
                     ,["make-hasheq", 0]
                     ,["make-hash", 0]
                     ,["hash-set!", 3 ]
                     ,["hash-ref", 3]
                     ,["hash-remove!", 2]
                     ,["hash-map", 2]
                     ,["hash-for-each", 2]
                     ,["hash?", 1]
                     
                     // Exception raising
                     ,["raise", 1]
                     
                     // Checking for undefined
                     ,["undefined?", 1]
                     
                     // values for multiple value definition
                     ,["values", 0, true]
                     
                     // structures
                     ,["make-struct-type", 4, true]
                     ,["make-struct-field-accessor", 2, true]
                     ,["make-struct-field-mutator", 2, true]
                     
                     // continuation mark stuff
                     // FIXME: add support for prompt optional argument
                     ,["current-continuation-marks", 0, false]
                     ,["continuation-mark-set->list", 2, false]
                     
                     // Things for javascript FFI and world
                     ,["scheme->prim-js", 1, false]
                     ,["prim-js->scheme", 1, false]
                     ,["procedure->cps-js-fun", 1, false]
                     ,["procedure->void-js-fun", 1, false]
                     ,["js-===", 2, false]
                     ,["js-get-named-object", 1, false]
                     ,["js-get-field", 2, true]
                     //,["get-js-array-field", 2, false]
                     ,["js-set-field!", 3, false]
                     //,["js-set-array-field!", 3, false]
                     ,["js-typeof", 1, false]
                     ,["js-instanceof", 2, false]
                     ,["js-call", 2, true]
                     ,["js-new", 1, true]
                     ,["js-make-hash", 0, true]
                     
                     ,["make-world-config", 2, true]
                     ,["make-bb-info", 2, false]
                     ,["bb-info?", 1, false]
                     ,["bb-info-change-world", 1, false]
                     ,["bb-info-toplevel-node", 1, false]
                     
                     ,["make-effect-type", 4, true]
                     ,["effect?", 1, false]
                     ,["world-with-effects", 2, false]
                     //,["coerce-world-handler", 1, false]
                     ,["make-render-effect-type", 4, true]
                     ,["render-effect-type?", 1]
                     ,["render-effect?", 1]
                     
                     //,["make-effect:do-nothing 0, false]
                     //,["effect:do-nothing? 1, false]
                     
                     ,["make-render-effect-type", 4, true]
                     //,["render-effect-name 1, false]
                     //,["render-effect-dom-node 1, false]
                     //,["render-effect-effects 1, false]
                     //,["render-effect? 1, false]
                     
                     ,["values", 0, true]
                     ,["sleep", 0, true]
                     ,["current-inexact-milliseconds", 0, false]
                     
                     ,["make-exn", 2, false]
                     ,["exn-message", 1, false]
                     ,["exn-continuation-marks", 1, false]
                      
                      // image functions
                      ,["image?", 1, false]
                      ,["image=?", 2, false]
                      ,["make-color", 3, false]
                      ,["color-red", 1, false]
                      ,["color-green", 1, false]
                      ,["color-blue", 1, false]
                      ,["color-alpha", 1, false]
                      ,["empty-scene", 2, false]
                      ,["circle", 3, false]
                      ,["triangle", 3, false]
                      ,["triangle/sas", 5, false]
                      ,["triangle/sss", 5, false]
                      ,["triangle/ass", 5, false]
                      ,["triangle/ssa", 5, false]
                      ,["triangle/aas", 5, false]
                      ,["triangle/asa", 3, false]
                      ,["triangle/saa", 3, false]
                      ,["right-triangle", 4, false]
                      ,["right-triangle", 4, false]
                      ,["radial-star", 5, false]
                      ,["square", 3, false]
                      ,["rectangle", 4, false]
                      ,["ellipse", 4, false]
                      ,["rhombus", 4, false]
                      ,["regular-polygon", 4, false]
                      ,["star", 3, false]
                      ,["star-polygon", 5, false]
                      ,["overlay", 2, true]
                      ,["overlay/xy", 4, false]
                      ,["overlay/align", 4, false]
                      ,["underlay", 2, true]
                      ,["underlay/xy", 4, false]
                      ,["underlay/align", 4, false]
                      ,["beside", 2, false]
                      ,["beside/align", 3, false]
                      ,["above", 2, false]
                      ,["above/align", 3, false]
                      ,["put-image", 4, false]
                      ,["place-image", 4, false]
                      ,["place-image/align", 6, false]
                      ,["line", 3, false]
                      ,["add-line", 6, false]
                      ,["scene+line", 6, false]
                      ,["put-pinhole", 3, false]
                      ,["rotate", 2, false]
                      ,["scale", 2, false]
                      ,["scale/xy", 3, false]
                      ,["crop", 5, false]
                      ,["frame", 1, false]
                      ,["flip-vertical", 1, false]
                      ,["flip-horizontal", 1, false]
                      ,["text", 3, false]
                      ,["text/font", 8, false]
                      ,["bitmap/url", 1, false]
                      ,["video/url", 1, false]
                      ,["image-width", 1, false]
                      ,["image-height", 1, false]
                      ,["image-baseline", 1, false]
                      ,["image->color-list", 1, false]
                      ,["color-list->image", 5, false]
                      ,["color-list->bitmap", 3, false]
                      ,["mode?", 1, false]
                      ,["image-color?", 1, false]
                      ,["name->color", 1, false]
                      ,["x-place?", 1, false]
                      ,["y-place?", 1, false]
                      ,["angle?", 1, false]
                      ,["side-count?", 1, false]
                      ,["step-count?", 1, false]
                      
                      ];
                       
  // The core environment includes bindings to Javascript-written functions.
  var coreEnv = coreBindings.reduce(function (env, nameAndArity){
                   if(nameAndArity.length === 2 ){
                      return r(env, nameAndArity[0], nameAndArity[1], false);
                   } else if(nameAndArity.length === 3 ){
                      return r(env, nameAndArity[0], nameAndArity[1], nameAndArity[3]);
                   }
                }, baseConstantsEnv);
  return coreEnv;
}


(function (){
  var makeHash = types.makeLowLevelEqHash;
  plt.compiler.keywords = ["cond", "else", "let", "case", "let*", "letrec", "quote",
                              "quasiquote", "unquote","unquote-splicing","local","begin",
                              "if","or","and","when","unless","lambda","λ","define",
                              "define-struct", "define-values"];

  // ENVIRONMENT STRUCTS ////////////////////////////////////////////////////////////////
  // Representation of the stack environment of the mzscheme vm, so we know where
  // things live.
  function env(bindings){
    this.bindings = bindings;
 
    // lookup : Symbol -> (or/c binding false)
    this.lookup = function(id){
      return (this.bindings.containsKey(id))? this.bindings.get(id) : false;
    };
 
    // contains?: symbol -> boolean
    this.contains = function(name){
      return this.lookup(name) !== false;
    };
 
    // keys : -> (listof symbol)
    this.keys = this.bindings.keys;
 
    // extend: binding -> env
    this.extend = function(binding){
      this.bindings.put(binding.name, binding);
      return new env(this.bindings);
    };
 
    // extendFunction : symbol (or/c string false) number boolean? Loc -> env
    // Extends the environment with a new function binding
    this.extendFunction = function(id, moduleSource, minArity, isVarArity, loc){
      return this.extend(new bindingFunction(id, moduleSource, minArity, isVarArity, [], false, loc));
    };
 
    // extendConstant : string (modulePath || false) Loc -> env
    this.extendConstant = function(id, moduleSource, loc){
      return this.extend(new bindingConstant(id, moduleSource, [], loc));
    };
 
    // lookup_context: identifier -> (binding | false)
    // Lookup an identifier, taking into account the context of the identifier.  If it has no existing
    // context, look at the given env. In either case, either return a binding, or false.
    this.lookup_context = function(id){
      if(id.context instanceof env){
        return id.context.contains(id)? id.context.lookup(id) : false;
      } else {
        return this.contains(id)? this.lookup(id) : false;
      }
    };
 
    this.extendEnv_moduleBinding = function(module){
      throw "extendEnv_moduleBinding not implemented yet! (see Structures.js)";
    };
 
    this.toString = function(){
      return this.bindings.values().reduce(function(s, b){
        return s+"\n  |---"+b.name;}, "");
    };
  }

  function emptyEnv(){ return new env(types.makeLowLevelEqHash());}
  function localEnv(name, boxed, parent){ this.name=name; this.boxed=boxed; this.parent=parent;}
  function globalEnv(names, boxed, parent){ this.names=names; this.boxed=boxed; this.parent=parent;}
  function unnamedEnv(parent){ this.parent=parent;}

 
 // export
 plt.compiler.env = env;

 // STACKREF STRUCTS ////////////////////////////////////////////////////////////////
  function stackReference(){}
  function localStackReference(name, isBoxed, depth){
    stackReference.call(this);
    this.name = name;
    this.isBoxed = isBoxed;
    this.depth = depth;
  }
  localStackReference.prototype = heir(stackReference.prototype);
  function globalStackReference(name, depth, pos){
    stackReference.call(this);
    this.name = name;
    this.pos = pos;
    this.depth = depth;
  }
  globalStackReference.prototype = heir(stackReference.prototype);
  function unboundStackReference(name){
    stackReference.call(this);
    this.name = name;
  }
  unboundStackReference.prototype = heir(stackReference.prototype);

  // position: symbol (listof symbol) -> (number || #f)
  // Find position of element in list; return false if we can't find the element.
  function position(x, lst){
    return (lst.indexOf(x) > -1)? lst.indexOf(x) : false;
  }
 
  // PINFO STRUCTS ////////////////////////////////////////////////////////////////
  var knownCollections = ["bootstrap", "bootstrap2011", "bootstrap2012", "bootstrap2014"];
 
  // These modules are hardcoded.
  var knownModules =  [ "world-module"
                       ,"world-stub-module"
                       ,"location-module"
                       ,"tilt-module"
                       ,"net-module"
                       ,"parser-module"
                       
                       ,"autos"
                       ,"bootstrap-gtp-teachpack"
                       ,"bootstrap-teachpack-translated"
                       ,"cage-teachpack-translated"
                       ,"compass-teachpack-translated"
                       ,"function-teachpack-translated"
                       ,"cage-teachpack"
                       ,"bootstrap-common"
                       ,"bootstrap-teachpack"
                       ,"cage-teachpack"
                       ,"function-teachpack"
                       ,"bootstrap-tilt-teachpack"
                       
                       ,"google-maps"
                       ,"phonegap"
                       
                       ,"telephony-module"
                       ,"moby-module-binding"
                       
                       ,"foreign-module"
                       ,"kernel-misc-module"];
 
  var defaultCurrentModulePath = "";
 
  // default-module-resolver: symbol -> (module-binding | false)
  // loop through known modules and see if we know this name
  plt.compiler.defaultModuleResolver = function(name){
    for(var i=0; i< knownModules.length; i++){
//      if(moduleBindingName(knownModules[i]) === name.val) return knownModules[i];
    }
    return false;
  }
 
  // default-module-path-resolver: module-path module-path -> module-name
  // Provides a default module resolver.
  plt.compiler.defaultModulePathResolver = function(path, parentPath){
    // anything of the form wescheme/w+, or that has a known collection AND module
    var parts = path.split("/"),
        collectionName = parts[0],
        moduleName = parts.slice(1).join();
    return ((knownCollections.indexOf(collectionName) > -1)
            && (knownModules.indexOf(moduleName) > -1))
          || /^wescheme\/\w+$/.exec(path);
  }
 

  // pinfo (program-info) is the "world" structure for the compilers;
  // it captures the information we get from analyzing and compiling
  // the program, and also maintains some auxillary structures.
  function pinfo(env, modules, usedBindingsHash, freeVariables, gensymCounter,
                 providedNames,definedNames, sharedExpressions,
                 withLocationEmits, allowRedefinition,
                 moduleResolver, modulePathResolver, currentModulePath,
                 declaredPermissions){
    this.env = env || new emptyEnv();                       // env
    this.modules = modules || [];                           // (listof module-binding)
    this.usedBindingsHash = usedBindingsHash || makeHash(); // (hashof symbol binding)
    this.freeVariables = freeVariables || [];               // (listof symbol)
    this.gensymCounter = gensymCounter || 0;                // number
    this.providedNames = providedNames || makeHash();       // (hashof symbol provide-binding)
    this.definedNames = definedNames || makeHash();         // (hashof symbol binding)
 
    this.sharedExpressions = sharedExpressions || makeHash();// (hashof expression labeled-translation)
    // Maintains a mapping between expressions and a labeled translation.  Acts
    // as a symbol table to avoid duplicate construction of common literal values.

    this.withLocationEmits = withLocationEmits || true;     // boolean
    // If true, the compiler emits calls to plt.Kernel.setLastLoc to maintain
    // source position during evaluation.

    this.allowRedefinition = allowRedefinition || false;     // boolean
    // If true, redefinition of a value that's already defined will not raise an error.
 
    // For the module system.
    // (module-name -> (module-binding | false))
    this.moduleResolver = moduleResolver || plt.compiler.defaultModuleResolver;
    // (string module-path -> module-name)
    this.modulePathResolver = modulePathResolver || plt.compiler.defaultModulePathResolver;
    // module-path
    this.currentModulePath = currentModulePath || defaultCurrentModulePath;
 
    this.declaredPermissions = declaredPermissions || [];   // (listof (listof symbol any/c))
 
    /////////////////////////////////////////////////
    // functions for manipulating pinfo objects
    this.isRedefinition = function(name){ return this.env.lookup(name); };
 
    // usedBindings: -> (listof binding)
    // Returns the list of used bindings computed from the program analysis.
    this.usedBindings =  this.usedBindingsHash.values;
 
    this.accumulateDeclaredPermission = function(name, permission){
      this.declaredPermissions = [[name, position]].concat(this.declaredPermissions);
      return this;
    };
 
    this.accumulateSharedExpression = function(expression, translation){
      var labeledTranslation = makeLabeledTranslation(this.gensymCounter, translation);
      this.sharedExpressions.put(labeledTranslation, expression);
      return this;
    };
 
    // accumulateDefinedBinding: binding loc -> pinfo
    // Adds a new defined binding to a pinfo's set.
    this.accumulateDefinedBinding = function(binding, loc){
      if(plt.compiler.keywords.indexOf(binding.name) > -1){
        throwError(new types.Message([new types.ColoredPart(binding.name, binding.loc),
                                  ": this is a reserved keyword and cannot be used"+
                                  " as a variable or function name"])
                   ,binding.loc);
      } else if(!this.allowRedefinition && this.isRedefinition(binding.name)){
        var prevBinding = this.env.lookup(binding.name);
        if(prevBinding.loc){
          throwError(new types.Message([new types.ColoredPart(binding.name, binding.loc),
                                    ": this name has a ",
                                    new types.ColoredPart("previous definition", prevBinding.loc),
                                    " and cannot be re-defined"])
                     ,binding.loc);
 
        } else {
          throwError(new types.Message([new types.ColoredPart(binding.name, binding.loc),
                                    ": this name has a ",
                                    "previous definition",
                                    " and cannot be re-defined"])
                     ,binding.loc);

        }
      } else {
        this.env.extend(binding);
        this.definedNames.put(binding.name, binding);
        return this;
      }
    };
 
    // accumulateBindings: (listof binding) Loc -> pinfo
    // Adds a list of defined bindings to the pinfo's set.
    this.accumulateDefinedBindings = function(bindings, loc){
      bindings.forEach(function(b){this.accumulateDefinedBinding(b, loc);});
      return this;
    };
 
 
    // accumuldateModuleBindings: (listof binding) -> pinfo
    // Adds a list of module-imported bindings to the pinfo's known set of bindings, without
    // including them within the set of defined names.
    this.accumulateModuleBindings = function(bindings){
      bindings.forEach(function(b){this.env.extend(binding);});
      return this;
    };
   
    // accumulateModule: module-binding -> pinfo
    // Adds a module to the pinfo's set.
    this.accumulateModule = function(module){
      this.modules = [module].concat(this.modules);
      return this;
    };

    // accumulateBindingUse: binding -> pinfo
    // Adds a binding's use to a pinfo's set.
    this.accumulateBindingUse = function(binding){
      this.usedBindingsHash.put(binding.name, binding);
      return this;
    };
   
    // accumulateFreeVariableUse: symbol -> pinfo
    // Mark a free variable usage.
    this.accumulateFreeVariableUse = function(sym){
      this.freeVariables = ((this.freeVariables.indexOf(sym) > -1)?
                            this.freeVariables : [sym].concat(this.freeVariables));
      return this;
    };
   
    // gensym: symbol -> [pinfo, symbol]
    // Generates a unique symbol.
    this.gensym = function(label){
      return [this, new symbolExpr(label+this.gensymCounter++)];
    };
 
    // permissions: -> (listof permission)
    // Given a pinfo, collect the list of permissions.
    this.permissions = function(){
      // unique : listof X -> listof X
      function unique(lst){
        if(lst.length === 0) return lst;
        else if(lst.slice(1).indexOf(lst[0]) > -1) return unique.slice(1)
        else return [lst[0]].concat(unique.slice(1));
      }
      function reducePermissions(permissions, binding){
        if(binding.isFunction) return binding.functionPermissions.concat(permissions);
        else if(binding.isConstant) return binding.constantPermissions.concat(permissions);
      }
      return unique(this.usedBindings().reduce(reducePermissions, []));
    }

    // getExposedBindings:  -> (listof binding)
    // Extract the list of the defined bindings that are exposed by provide.
    this.getExposedBindings = function(){
      // lookupProvideBindingInDefinitionBindings: provide-binding compiled-program -> (listof binding)
      // Lookup the provided bindings.
      function lookupProvideBindingInDefinitionBindings(provideBinding){
        var binding;
        if(this.definedNames.containsKey(provideBinding.stx)){
          binding = checkBindingCompatibility(binding, this.definedNames.get(provideBinding.stx));
        } else {
          throwError(new types.Message(["provided-name-not-defined: ", provideBinding.stx]));
        }

        // ref: symbol -> binding
        // Lookup the binding, given the symbolic identifier.
        function ref(id){ return this.definedNames.get(id); }
 
        // if it's a struct provide, return a list containing the constructor and predicate,
        // along with all the accessor and mutator functions
        if(provideBinding instanceof structId){
          [binding, ref(binding.structureConstructor), ref(binding.structurePredicate)].concat(
              binding.structureAccessors.map(ref), binding.structureMutators.map(ref));
        } else {
          return [binding];
        }
      }
 
      // decorateWithPermissions: binding -> binding
      // HACK!
      function decorateWithPermissions(binding){
        var bindingEntry = function(entry){return entry[0]===binding.id;},
            filteredPermissions = this.declaredPermissions.filter(bindingEntry);
        binding.updatePermissions(filteredPermissions.map(function(p){return p[1];}));
        return binding;
      }

      // Make sure that if the provide says "struct-out ...", that the exported binding
      // is really a structure.
      function checkBindingCompatibility(binding, exportedBinding){
        if(binding instanceof structureId){
          if(exportedBinding instanceof structure){
            return exportedBinding;
          } else {
            throwError(new types.Message(["provided-structure-not-structure: ", exportedBinding.stx]));
          }
        } else {
          return exportedBinding;
        }
      }
 
      var keys = this.providedNames.keys, bindings = this.providedNames.values;
      // for each provide binding, ensure it's defined and then decorate with permissions
      // concat all the permissions and bindings together, and return
      return bindings.reduce(function(acc, b){
         acc.concat(decorateWithPermissions(lookupProvideBindingInDefinitionBindings(b)));
        }, []);
 
    };
 
    this.toString = function(){
      var s = "pinfo-------------";
 s+= "\n**env****: "+this.env.toString();
 s+= "\n**modules**: "+this.modules.join(",");
 s+= "\n**used bindings**: "+this.usedBindings();
 s+= "\n**free variables**: "+this.freeVariables.join(",");
 s+= "\n**gensym counter**: "+this.gensymCounter;
 s+= "\n**provided names**: "+this.providedNames.values();
 s+= "\n**defined names**: "+this.definedNames.values();
 return s;
    };
 }
 
 // getBasePinfo: symbol -> pinfo
 // Returns a pinfo that knows the base definitions. Language can be one of the following:
 // 'base
 // 'moby
 function getBasePinfo(language){
    var pinfo = new plt.compiler.pinfo();
    if(language === "moby"){
      pinfo.env = extendEnv_moduleBinding(getTopLevelEnv(language),
                                          mobyModuleBinding);
    } else if(language === "base"){
      pinfo.env = getTopLevelEnv(language);
    }
    return pinfo;
 }
 
 plt.compiler.emptyEnv = emptyEnv;
 plt.compiler.localEnv = localEnv;
 plt.compiler.globalEnv = globalEnv;
 plt.compiler.unnamedEnv = unnamedEnv;
 plt.compiler.getBasePinfo = getBasePinfo;
 plt.compiler.pinfo = pinfo;
})();
