goog.provide('plt.compiler.throwError');

goog.provide('plt.compiler.Program');
goog.provide('plt.compiler.comment');
goog.provide('plt.compiler.couple');
goog.provide('plt.compiler.defFunc');
goog.provide('plt.compiler.defVar');
goog.provide('plt.compiler.defVars');
goog.provide('plt.compiler.defStruct');
goog.provide('plt.compiler.beginExpr');
goog.provide('plt.compiler.lambdaExpr');
goog.provide('plt.compiler.localExpr');
goog.provide('plt.compiler.letrecExpr');
goog.provide('plt.compiler.letExpr');
goog.provide('plt.compiler.letStarExpr');
goog.provide('plt.compiler.condExpr');
goog.provide('plt.compiler.caseExpr');
goog.provide('plt.compiler.andExpr');
goog.provide('plt.compiler.orExpr');
goog.provide('plt.compiler.callExpr');
goog.provide('plt.compiler.ifExpr');
goog.provide('plt.compiler.whenUnlessExpr');
goog.provide('plt.compiler.symbolExpr');
goog.provide('plt.compiler.literal');
goog.provide('plt.compiler.quotedExpr');
goog.provide('plt.compiler.unquotedExpr');
goog.provide('plt.compiler.quasiquotedExpr');
goog.provide('plt.compiler.unquoteSplice');
goog.provide('plt.compiler.requireExpr');
goog.provide('plt.compiler.provideStatement');
goog.provide('plt.compiler.unsupportedExpr');

goog.provide('plt.compiler.pinfo');
goog.provide('plt.compiler.getBasePinfo');
goog.provide('plt.compiler.isExpression');
goog.provide('plt.compiler.isDefinition');
goog.provide('plt.compiler.env');
goog.provide('plt.compiler.emptyEnv');
goog.provide('plt.compiler.localEnv');
goog.provide('plt.compiler.globalEnv');
goog.provide('plt.compiler.moduleBinding');
goog.provide('plt.compiler.functionBinding');
goog.provide('plt.compiler.constantBinding');
goog.provide('plt.compiler.structBinding');
goog.provide('plt.compiler.unnamedEnv');

//goog.require("plt.compiler.knownCollections");


// if not defined, declare the compiler object as part of plt
window.plt   = window.plt   || {};
plt.compiler = plt.compiler || {};

/*
 TODO
 - have modulePathResolver return the proper name!
 */

//////////////////////////////////////////////////////////////////////////////
/////////////////// COMMON FUNCTIONS AND STRUCTURES //////////////////////////
//////////////// used by multiple phases of the compiler/////////////////////

(function () {
 'use strict';
 
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
        return {text: part.text, type: 'ColoredPart', loc: part.location.toString()
              , toString: function(){return part.text;}};
      } else if(part.locations !== undefined){
        return {text: part.text, type: 'MultiPart', solid: part.solid
              , locs: part.locations.map(function(l){return l.toString()})
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
                             , ["span", [["class", "location-offset"]], (loc.startChar+1).toString()]
                             , ["span", [["class", "location-line"]]  , loc.startRow.toString()]
                             , ["span", [["class", "location-column"]], loc.startCol.toString()]
                             , ["span", [["class", "location-span"]]  , loc.span.toString()]
                             , ["span", [["class", "location-id"]]    , loc.source.toString()]
                             ]
                          ]
                        ]
      , "structured-error": JSON.stringify({message: (errorClass? false : msg.args), location: loc.toString() })
    };
    throw JSON.stringify(json);
  }

  // couple = pair
  function couple(first, second) {
    this.first = first;
    this.second = second;
    this.toString = function(){
      return "("+this.first.toString() +" "+this.second.toString()+")";
    };
  };

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

  // all Programs, by default, print out their values
  // anything that behaves differently must provide their own toString() function
  var Program = function() {
    // -> String
    this.toString = function(){ return this.val.toString(); };
    // every Program has a location, but it's initialized to null
    this.location = null;
  };

  // Comments
  function comment(txt) {
    Program.call(this);
    this.txt = txt;
    this.toString = function(){
      return ";" + this.txt;
    };
  };
  comment.prototype = heir(Program.prototype);

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
      return "(local ("+this.defs.toString()+") "+this.body.toString()+")";
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

  // when/unless expression
  function whenUnlessExpr(predicate, exprs, stx) {
    Program.call(this);
    this.predicate = predicate;
    this.exprs = exprs;
    this.stx = stx;
    this.toString = function(){
      return "("+this.stx[0]+" "+this.predicate.toString()+" "+this.exprs.toString()+")";
    };
  };
  whenUnlessExpr.prototype = heir(Program.prototype);

  // symbol expression (ID)
  function symbolExpr(val, stx) {
    Program.call(this);
    this.val = val;
    this.stx = stx;
  };
  symbolExpr.prototype = heir(Program.prototype);

  // Literal values (String, Char, Number, Vector)
  function literal(val) {
    Program.call(this);
    this.val = val;
    this.toString = function(){
      // racket prints booleans using #t and #f
      if(this.val===true) return "#t";
      if(this.val===false) return "#f";
      // racket prints special chars using their names
      if(this.val instanceof Char){
        var c = this.val.val;
        return c === '\b' ? '#\\backspace' :
              c === '\t' ? '#\\tab' :
              c === '\n' ? '#\\newline' :
              c === ' '  ? '#\\space' :
              c === '\v' ? '#\\vtab' :
              /* else */  this.val.toWrittenString();
      }
      return types.toWrittenString(this.val);
    }
  };
  literal.prototype = heir(Program.prototype);

  Vector.prototype.toString = Vector.prototype.toWrittenString = function(){
    var filtered = this.elts.filter(function(e){return e!==undefined;}),
        last = filtered[filtered.length-1];
    return "#("+this.elts.map(function(elt){return elt===undefined? last : elt;})+")";
  }

  // quoted expression
  function quotedExpr(val) {
    Program.call(this);
    this.val = val;
    this.toString = function() {
      function quoteLikePairP(v) {
        return v instanceof Array
          && v.length === 2
          && v[0] instanceof symbolExpr
          && (    v[0].val === 'quasiquote'
                  || v[0].val === 'quote'
                  || v[0].val === 'unquote'
                  || v[0].val === 'unquote-splicing'
             ) }
      function shortName(lexeme) {
        var s = lexeme.val
        return s === 'quasiquote' ? "`" :
          s === 'quote' ? "'" :
          s === 'unquote' ? "," :
          s === 'unquote-splicing' ? ",@" :
          (function () { throw "impossible quote-like string" })()
      }
      function elementToString(v) {
        if (quoteLikePairP(v)) {
          return shortName(v[0]).concat(elementToString(v[1]))
        } else if (v instanceof Array) {
          return v.reduce(function (acc, x) { return acc.concat(elementToString(x)) }, "(").concat(")")
        } else {
          return v.toString()
        }
      }

      return "'"+elementToString(this.val)
    }
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


  function isExpression(node){
    return !(   (node instanceof defVar)
             || (node instanceof defVars)
             || (node instanceof defStruct)
             || (node instanceof defFunc)
             || (node instanceof provideStatement)
             || (node instanceof unsupportedExpr)
             || (node instanceof requireExpr));
  }

  function isDefinition(node){
    return (node instanceof defVar)
        || (node instanceof defVars)
        || (node instanceof defStruct)
        || (node instanceof defFunc);
  }

  /**************************************************************************
   *
   *    STRUCTURES NEEDED BY THE COMPILER
   *
   **************************************************************************/

  // moduleBinding: records an id and its associated JS implementation.
  function moduleBinding(name, bindings){
    this.name     = name;
    this.bindings = bindings;
  }

  // constantBinding: records an id and its associated JS implementation.
  function constantBinding(name, moduleSource, permissions, loc){
    this.name = name;
    this.moduleSource = moduleSource;
    this.permissions = permissions;
    this.loc = loc;
    this.toString = function(){return this.name;};
    return this;
  }

  // functionBinding: try to record more information about the toplevel-bound function
  function functionBinding(name, moduleSource, minArity, isVarArity, permissions, isCps, loc){
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

  // structBinding: A binding to a structure.
  // structBinding : symbol, ?, (listof symbol), symbol, symbol, (listof symbol) (listof symbol) (listof permission), location -> Binding
  function structBinding(name, moduleSource, fields, constructor,
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

  var makeHash = types.makeLowLevelEqHash;
  plt.compiler.keywords = ["cond", "else", "let", "case", "let*", "letrec", "quote",
                              "quasiquote", "unquote","unquote-splicing","local","begin",
                              "if","or","and","when","unless","lambda","λ","define",
                              "define-struct", "define-values"];

  // ENVIRONMENT STRUCTS ////////////////////////////////////////////////////////////////
  // Representation of the stack environment of the mzscheme vm, so we know where
  // things live.
  function env(bindings){
    var that = this;
    this.bindings = bindings || makeHash();
 
    // lookup : Symbol -> (or/c binding false)
    this.lookup = function(id){
      return (this.bindings.containsKey(id))? this.bindings.get(id) : false;
    };
 
    // peek: Number -> env
    this.peek = function(depth){
      return (depth==0)?                  this
          :  (this instanceof emptyEnv)?  "IMPOSSIBLE - peeked at an emptyEnv!"
           /* else */                   : this.parent.peek(depth-1);
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
      return new plt.compiler.env(this.bindings);
    };
 
    // extendFunction : symbol (or/c string false) number boolean? Loc -> env
    // Extends the environment with a new function binding
    this.extendFunction = function(id, moduleSource, minArity, isVarArity, loc){
      return this.extend(new functionBinding(id, moduleSource, minArity, isVarArity, [], false, loc));
    };
 
    // extendConstant : string (modulePath || false) Loc -> env
    this.extendConstant = function(id, moduleSource, loc){
      return this.extend(new constantBinding(id, moduleSource, [], loc));
    };
 
    // lookup_context: identifier -> (binding | false)
    // Lookup an identifier, taking into account the context of the identifier.  If it has no existing
    // context, look at the given env. In either case, either return a binding, or false.
    this.lookup_context = function(id){
      if(id.context instanceof env){
        return id.context.contains(id)? id.context.lookup(id) : false;
      } else {
        return that.contains(id)? that.lookup(id) : false;
      }
    };
 
    // traverse rthe bindings of the module
    this.extendEnv_moduleBinding = function(module){
      return module.bindings.reduceRight(function(env, binding){ return env.extend(binding);}, this);
    };
 
    this.toString = function(){
      return this.bindings.values().reduce(function(s, b){
        return s+"\n  |---"+b.name;}, "");
    };
  }
 
  // sub-classes of env
  function emptyEnv(){
    env.call(this);
    this.lookup = function(name, depth){ return new plt.compiler.unboundStackReference(name); };
  }
  emptyEnv.prototype = heir(env.prototype);
 
  function unnamedEnv(parent){
    env.call(this);
    this.parent = parent;
    this.lookup = function(name, depth){ return this.parent.lookup(name, depth+1); };
  }
  unnamedEnv.prototype = heir(env.prototype);
 
  function localEnv(name, boxed, parent){
    env.call(this);
    this.name   = name;
    this.boxed  = boxed;
    this.parent = parent;
    this.lookup = function(name, depth){
      return (name===this.name)? new plt.compiler.localStackReference(name, this.boxed, depth)
                              : this.parent.lookup(name, depth+1);
    };
  }
  localEnv.prototype = heir(env.prototype);
 
  function globalEnv(names, boxed, parent){
    env.call(this);
    this.names  = names;
    this.boxed  = boxed;
    this.parent = parent;
    var that = this;
    this.lookup = function(name, depth){
      var pos = this.names.indexOf(name);
      return (pos > -1)? new plt.compiler.globalStackReference(name, depth, pos)
                  : this.parent.lookup(name, depth+1);
    };
  }
  globalEnv.prototype = heir(env.prototype);
 
  // PINFO STRUCTS ////////////////////////////////////////////////////////////////
  var defaultCurrentModulePath = "";
 
  // default-module-resolver: symbol -> (module-binding | false)
  // loop through known modules and see if we know this name
  plt.compiler.defaultModuleResolver = function(name){
    for(var i=0; i<plt.compiler.knownModules.length; i++){
      if(plt.compiler.knownModules[i].name === name) return plt.compiler.knownModules[i];
    }
    return false;
  }
 
  // Compute the edit distance between the two given strings
  // from http://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance
  function levenshteinDistance(a, b) {
    if(a.length === 0) return b.length; 
    if(b.length === 0) return a.length; 
   
    var matrix = [];
   
    // increment along the first column of each row
    for(var i = 0; i <= b.length; i++){ matrix[i] = [i]; }
   
    // increment each column in the first row
    for(var j = 0; j <= a.length; j++){ matrix[0][j] = j; }
   
    // Fill in the rest of the matrix
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        if(b.charAt(i-1) == a.charAt(j-1)){
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                  Math.min(matrix[i][j-1] + 1, // insertion
                                           matrix[i-1][j] + 1)); // deletion
        }
      }
    }
    return matrix[b.length][a.length];
  };
 
  // moduleGuess: symbol -> symbol
  // loop through known modules and make best suggestion for a given name
  plt.compiler.moduleGuess = function(wrongName){
    return plt.compiler.knownModules.reduce(function(best, module){
                                            var dist = levenshteinDistance(module.name, wrongName);
                                            return (dist < best.distance)? {name: module.name, distance: dist} : best;
      }, {name: wrongName, distance: 5});
  }
 
  // default-module-path-resolver: module-path module-path -> module-name
  // Provides a default module resolver.
  plt.compiler.defaultModulePathResolver = function(path, parentPath){
/*    var name = (path instanceof symbolExpr)? path : modulePathJoin(parentPath, path)),
        moduleName = knownModules.reduceRight(function(name, km){
              return (km.source === modulePathJoin(parentPath, path))? km.name : name;}
                                              , name);
*/ 
    // anything of the form wescheme/w+, or that has a known collection AND module
    var parts = path.toString().split("/"),
        collectionName = parts[0],
        moduleName = parts.slice(1).join();
    return ((plt.compiler.knownCollections.indexOf(collectionName) > -1)
            && plt.compiler.defaultModuleResolver(path.toString()))
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
    this.definedNames  = definedNames  || makeHash();       // (hashof symbol binding)
 
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
      this.declaredPermissions = [[name, permission]].concat(this.declaredPermissions);
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
      var that = this;
      bindings.forEach(function(b){that.accumulateDefinedBinding(b, loc);});
      return this;
    };
 
 
    // accumuldateModuleBindings: (listof binding) -> pinfo
    // Adds a list of module-imported bindings to the pinfo's known set of bindings, without
    // including them within the set of defined names.
    this.accumulateModuleBindings = function(bindings){
      var that = this;
      bindings.forEach(function(b){that.env.extend(b);});
      return this;
    };
   
    // accumulateModule: module-binding -> pinfo
    // Adds a module to the pinfo's set.
    this.accumulateModule = function(module){
      this.modules = [module].concat(this.modules);
      return this;
    };

    // accumulateBindingUse: binding -> pinfo
    // Adds a binding's use to a pinfo's set, if it has not already been used as a global
    // This qualifier allows a fn argument to shadow a global, without removing it from the environment
    this.accumulateBindingUse = function(binding){
      var alreadyExists = this.usedBindingsHash.get(binding.name);
      // if it's a module binding, don't replace it with a different kind of binding
      if(!(alreadyExists && alreadyExists.moduleSource)) this.usedBindingsHash.put(binding.name, binding);
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
    // Generates a unique symbol
    this.gensym = function(label){
      return [this, new symbolExpr(label+this.gensymCounter++)];
    };
 
    // permissions: -> (listof permission)
    // Given a pinfo, collect the list of permissions.
    this.permissions = function(){
      // onlyUnique : v, idx, arr -> arr with unique elts
      // from http://stackoverflow.com/questions/1960473/unique-values-in-an-array
      function onlyUnique(value, index, self) { return self.indexOf(value) === index; }
      // if it's a function or constant binding, add its permissions to the list
      function reducePermissions(permissions, b){
        return (((b instanceof functionBinding) || (b instanceof constantBinding))
                && (b.permissions.length > 0))?
              permissions.concat(b.permissions) : permissions;
      }
      return this.usedBindings().reduce(reducePermissions, []).filter(onlyUnique);
    }

    // getExposedBindings:  -> (listof binding)
    // Extract the list of the defined bindings that are exposed by provide.
    this.getExposedBindings = function(){
      var that = this;
      // lookupProvideBindingInDefinitionBindings: provide-binding compiled-program -> (listof binding)
      // Lookup the provided bindings.
      function lookupProvideBindingInDefinitionBindings(provideBinding){
        // if it's not defined, throw an error
        if(!that.definedNames.containsKey(provideBinding.symbl)){
          throwError(new types.Message(["provided-name-not-defined: ", provideBinding.symbl]));
        }
        // if it IS defined, let's examine it and make sure it is what it claims to be
        var binding = checkBindingCompatibility(binding, that.definedNames.get(provideBinding.symbl));

        // ref: symbol -> binding
        // Lookup the binding, given the symbolic identifier.
        function ref(id){ return that.definedNames.get(id); }

        // if it's a struct provide, return a list containing the constructor and predicate,
        // along with all the accessor and mutator functions
        if(provideBinding instanceof plt.compiler.provideBindingStructId){
          return [ref(binding.constructor), ref(binding.predicate)].concat(
              binding.accessors.map(ref), binding.mutators.map(ref));
        } else {
          return [binding];
        }
      }
 
      // decorateWithPermissions: binding -> binding
      // THIS IS A HACK according to Danny's original sources...not sure why
      function decorateWithPermissions(binding){
        var bindingEntry = function(entry){return entry[0]===binding.name;},
            filteredPermissions = that.declaredPermissions.filter(bindingEntry);
        binding.permissions = filteredPermissions.map(function(p){return p[1];});
        return binding;
      }

      // Make sure that if the provide says "struct-out ...", that the exported binding
      // is really a structure.
      function checkBindingCompatibility(binding, exportedBinding){
        if(  (binding instanceof plt.compiler.provideBindingStructId)
          && (!(exportedBinding instanceof structBinding))){
            throwError(new types.Message(["provided-structure-not-structure: ", exportedBinding.symbl]));
        } else {
          return exportedBinding;
        }
      }
 
      // for each provide binding, ensure it's defined and then decorate with permissions
      // concat all the permissions and bindings together, and return
      bindings = bindings.reduce(function(acc, b){ return acc.concat(lookupProvideBindingInDefinitionBindings(b)); }, []);
      return bindings.map(decorateWithPermissions);
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
       s+= "\n**permissions**: "+this.permissions();
       return s;
    };
 }
 
 // getBasePinfo: symbol -> pinfo
 // Returns a pinfo that knows the base definitions. Language can be one of the following:
 // 'base
 // 'moby
 function getBasePinfo(language){
    // fixme: use the language to limit what symbols get in the toplevel.
    var baseConstantsEnv = ["null", "empty", "true"//effect:do-nothing
                           , "false", "eof", "pi", "e","js-undefined"
                           , "js-null"].reduce(function(env, id){
                                               return env.extendConstant(id.toString(), '"moby/toplevel"', false)
                                               }, new emptyEnv());

    var pinfo = new plt.compiler.pinfo(),
        topLevelEnv = plt.compiler.topLevelModules.reduceRight(function(env, mod){
                                                               return env.extendEnv_moduleBinding(mod);
                                                               }, baseConstantsEnv);
    if(language === "moby"){
      pinfo.env = topLevelEnv.extendEnv_moduleBinding(mobyModuleBinding);
    } else if(language === "base"){
      pinfo.env = topLevelEnv;
    }
    return pinfo;
 }
 
 plt.compiler.throwError    = throwError;
 
 plt.compiler.Program       = Program;
 plt.compiler.comment       = comment;
 plt.compiler.couple        = couple;
 plt.compiler.defFunc       = defFunc;
 plt.compiler.defVar        = defVar;
 plt.compiler.defVars       = defVars;
 plt.compiler.defStruct     = defStruct;
 plt.compiler.beginExpr     = beginExpr;
 plt.compiler.lambdaExpr    = lambdaExpr;
 plt.compiler.localExpr     = localExpr;
 plt.compiler.letrecExpr    = letrecExpr;
 plt.compiler.letExpr       = letExpr;
 plt.compiler.letStarExpr   = letStarExpr;
 plt.compiler.condExpr      = condExpr;
 plt.compiler.caseExpr      = caseExpr;
 plt.compiler.andExpr       = andExpr;
 plt.compiler.orExpr        = orExpr;
 plt.compiler.callExpr      = callExpr;
 plt.compiler.ifExpr        = ifExpr;
 plt.compiler.whenUnlessExpr= whenUnlessExpr;
 plt.compiler.symbolExpr    = symbolExpr;
 plt.compiler.literal       = literal;
 plt.compiler.quotedExpr    = quotedExpr;
 plt.compiler.unquotedExpr  = unquotedExpr;
 plt.compiler.quasiquotedExpr=quasiquotedExpr;
 plt.compiler.unquoteSplice = unquoteSplice;
 plt.compiler.requireExpr   = requireExpr;
 plt.compiler.provideStatement = provideStatement;
 plt.compiler.unsupportedExpr= unsupportedExpr;

 plt.compiler.pinfo       = pinfo;
 plt.compiler.getBasePinfo= getBasePinfo;
 plt.compiler.isExpression= isExpression;
 plt.compiler.isDefinition= isDefinition;
 plt.compiler.env         = env;
 plt.compiler.emptyEnv    = emptyEnv;
 plt.compiler.localEnv    = localEnv;
 plt.compiler.globalEnv   = globalEnv;
 plt.compiler.moduleBinding  = moduleBinding;
 plt.compiler.functionBinding  = functionBinding;
 plt.compiler.constantBinding  = constantBinding;
 plt.compiler.structBinding  = structBinding;
 plt.compiler.unnamedEnv  = unnamedEnv;
})();
