goog.provide('plt.compiler.parse');

goog.require("plt.compiler.literal");
goog.require("plt.compiler.symbolExpr");
goog.require("plt.compiler.Program");
goog.require("plt.compiler.couple");
goog.require("plt.compiler.ifExpr");
goog.require("plt.compiler.beginExpr");
goog.require("plt.compiler.letExpr");
goog.require("plt.compiler.letStarExpr");
goog.require("plt.compiler.letrecExpr");
goog.require("plt.compiler.localExpr");
goog.require("plt.compiler.andExpr");
goog.require("plt.compiler.orExpr");
goog.require("plt.compiler.condExpr");
goog.require("plt.compiler.caseExpr");
goog.require("plt.compiler.lambdaExpr");
goog.require("plt.compiler.quotedExpr");
goog.require("plt.compiler.unquotedExpr");
goog.require("plt.compiler.quasiquotedExpr");
goog.require("plt.compiler.unquoteSplice");
goog.require("plt.compiler.callExpr");
goog.require("plt.compiler.whenUnlessExpr");
goog.require("plt.compiler.defFunc");
goog.require("plt.compiler.defVar");
goog.require("plt.compiler.defVars");
goog.require("plt.compiler.defStruct");
goog.require("plt.compiler.requireExpr");
goog.require("plt.compiler.provideStatement");
goog.require("plt.compiler.unsupportedExpr");
goog.require("plt.compiler.throwError");

// if not defined, declare the compiler object as part of plt
window.plt   = window.plt   || {};
plt.compiler = plt.compiler || {};

/*
 
 //////////////////////////////////////////////////////////////////////////////
 ///////////////////////////////// PARSER OBJECT //////////////////////////////
 //////////////////////////////////////////////////////////////////////////////
 
 Parser for http://docs.racket-lang.org/htdp-langs/intermediate-lam.html
 
 * Given an Array of SExps, produce an array of Programs or a structured error
 * see structures.js for Program Objects and Error throwing
 
 TODO
 - Perf: give location information to all AST nodes as constructor argument
 - JSLint
 */

(function () {
 'use strict';
 
 // import frequently-used bindings
 var literal          = plt.compiler.literal;
 var symbolExpr       = plt.compiler.symbolExpr;
 var Program          = plt.compiler.Program;
 var couple           = plt.compiler.couple;
 var ifExpr           = plt.compiler.ifExpr;
 var beginExpr        = plt.compiler.beginExpr;
 var letExpr          = plt.compiler.letExpr;
 var letStarExpr      = plt.compiler.letStarExpr;
 var letrecExpr       = plt.compiler.letrecExpr;
 var localExpr        = plt.compiler.localExpr;
 var andExpr          = plt.compiler.andExpr;
 var orExpr           = plt.compiler.orExpr;
 var condExpr         = plt.compiler.condExpr;
 var caseExpr         = plt.compiler.caseExpr;
 var lambdaExpr       = plt.compiler.lambdaExpr;
 var quotedExpr       = plt.compiler.quotedExpr;
 var unquotedExpr     = plt.compiler.unquotedExpr;
 var quasiquotedExpr  = plt.compiler.quasiquotedExpr;
 var unquoteSplice    = plt.compiler.unquoteSplice;
 var callExpr         = plt.compiler.callExpr;
 var whenUnlessExpr   = plt.compiler.whenUnlessExpr;
 var defFunc          = plt.compiler.defFunc;
 var defVar           = plt.compiler.defVar;
 var defVars          = plt.compiler.defVars;
 var defStruct        = plt.compiler.defStruct;
 var requireExpr      = plt.compiler.requireExpr;
 var provideStatement = plt.compiler.provideStatement;
 var unsupportedExpr  = plt.compiler.unsupportedExpr;
 var throwError       = plt.compiler.throwError;
 
 //////////////////////////////////// UTILITY FUNCTIONS //////////////////////////////
 function isVector(x) { return types.isVector(x.val); }
 function isString(x) { return types.isString(x.val); }
 function isSymbol(x) { return x instanceof symbolExpr; }
 function isLiteral(x){ return x instanceof literal; }
 function isUnsupported(x){ return x instanceof unsupportedExpr;}
 
 function isCons(x)  { return x instanceof Array && x.length>=1;}
 function rest(ls)   { return ls.slice(1); }
 
 // isSymbolEqualTo : symbolExpr symbolExpr -> Boolean
 // are these all symbols of the same value?
 function isSymbolEqualTo(x, y) {
    x = (x instanceof symbolExpr)? x.val : x;
    y = (y instanceof symbolExpr)? y.val : y;
    return x === y;
 }
 
  // PARSING ///////////////////////////////////////////
 
   // parse* : sexp list -> Program list
  function parseStar(sexps) {
   function parseSExp(sexp) {
    return isDefinition(sexp) ? parseDefinition(sexp) :
           isExpr(sexp) ? parseExpr(sexp) :
           isRequire(sexp) ? parseRequire(sexp) :
           isProvide(sexp) ? parseProvide(sexp) :
     throwError(new types.Message(["Not a Definition, Expression, Library Require, or Provide"]),
                                  sexp.location);
    }
    return sexps.map(parseSExp);
  }
 
  // parse : sexp list -> Program list
  function parse(sexp) {
    return (sexp.length === 0) ? [] :
    (!isCons(sexp)) ? throwError(new types.Message(["The sexp is not a list of definitions or expressions: "+sexp]),
                                sexp.location):
    parseStar(sexp);
  }


  //////////////////////////////////////// DEFINITION PARSING ////////////////////////////////
  // (define-struct ...)
  function isStructDefinition(sexp) {
    return ((isCons(sexp)) && (isSymbol(sexp[0])) && (isSymbolEqualTo("define-struct", sexp[0])));
  }
  // (define ...)
  function isOldDefinition(sexp) {
    return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define", sexp[0]));
  }
  // (define x ...)
  function isValueDefinition(sexp) {
    return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define-val", sexp[0]));
  }
  // (define x ...)
  function isFunDefinition(sexp) {
    return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define-fun", sexp[0]));
  }
  // (define-values ...)
  function isMultiValueDefinition(sexp) {
    return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define-values", sexp[0]));
  }
  // is it any kind of definition?
  function isDefinition(sexp) {
    return isStructDefinition(sexp) || isOldDefinition(sexp) || isMultiValueDefinition(sexp)
      || isValueDefinition(sexp) || isFunDefinition(sexp);
  }
 
  // : parseDefinition : SExp -> AST (definition)
  function parseDefinition(sexp) {
    function parseDefStruct(sexp) {
      // is it just (define-struct)?
      if(sexp.length < 2){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected the structure name after define-struct, but nothing's there"])
                   , sexp.location);
      }
      // is the structure name there?
      if(!(sexp[1] instanceof symbolExpr)){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected the structure name after define-struct, but found "
                                      , new types.ColoredPart("something else", sexp[1].location)])
                   , sexp.location);
      }
      // is it just (define-struct <name>)?
      if(sexp.length < 3){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one field name (in parentheses) after the "
                                      , new types.ColoredPart("structure name", sexp[1].location)
                                      , ", but nothing's there"])
                   , sexp.location);
      }
      // is the structure name followed by a list?
      if(!(sexp[2] instanceof Array)){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one field name (in parentheses) after the "
                                      , new types.ColoredPart("structure name", sexp[1].location)
                                      , ", but found "
                                      , new types.ColoredPart("something else", sexp[2].location)])
                   , sexp.location);
      }
      // is it a list of not-all-symbols?
      sexp[2].forEach(function(arg){
        if (!(arg instanceof symbolExpr)){
          throwError(new types.Message([new types.ColoredPart(sexp[0]. val,sexp[0].location)
                                      , ": expected a field name, but found "
                                      , new types.ColoredPart("something else", arg.location)])
                   , sexp.location);
        }
      });
      // too many expressions?
      if(sexp.length > 3){
          var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
              wording1 = (sexp[2].length === 1)? "field name" : "field names",
              wording2 = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected nothing after the "
                                      , new types.ColoredPart(wording1, sexp[2].location)
                                      , ", but found "
                                      , new types.MultiPart(wording2, extraLocs, false)])
                     , sexp.location);
      }
      return new defStruct(parseIdExpr(sexp[1]), sexp[2].map(parseIdExpr), sexp);
    }
    function parseMultiDef(sexp){
      // is it just (define-values)?
      if(sexp.length < 2){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expects a list of variables and a body, but found neither"])
                     , sexp.location);
      }
      // is it just (define-values ... )?
      if(sexp.length < 3){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expects a list of variables and a body, but found only "
                                      , new types.ColoredPart("one part", sexp[1].location)])
                     , sexp.location);
      }
      // is it (define-values <not a list> )?
      if(!(sexp[1] instanceof Array)){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expects a list of variables and a body, but found "
                                      , new types.ColoredPart("something else", sexp[1].location)])
                     , sexp.location);
      }
      // too many parts?
      if(sexp.length > 3){
          var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
              wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts"),
              msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                       , ": expects a list of variables and a body"
                                        + ", but found "
                                       , new types.MultiPart(wording, extraLocs, false)]);
          throwError(msg, sexp.location);
      }
      return new defVars(sexp[1].map(parseIdExpr), parseExpr(sexp[2]), sexp);
    }
    function parseOldDef(sexp) {
      // is it just (define)?
      if(sexp.length !== 3){
        var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; });
        var wording = (sexp.length<4)? " fewer than two" : new types.MultiPart("more than two parts", extraLocs, false);
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected exactly two parts for the definition: a name"
                                    + " (or a function name and its variables) and an expression"
                                    + ", but found"
                                    , wording])
                   , sexp.location);
      }
      // (define a b c ...) -- too many parts?
      if(sexp.length > 3){
          var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; }),
              wording = extraLocs.length + " parts";
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected exactly two parts, but found"
                                        , new types.MultiPart(wording, extraLocs, false)])
                     , sexp.location);
      }
      // If it's (define (...)...)
      if(sexp[1] instanceof Array){
          // is there at least one element?
          if(sexp[1].length === 0){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least a function name within "
                                      , new types.ColoredPart("the parentheses", sexp[1].location)])
                       , sexp.location);
          }
          // is the first element in the list a symbol?
          if(!(sexp[1][0] instanceof symbolExpr)){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a function name after the open parenthesis but found "
                                      , new types.ColoredPart("something else", sexp[1][0].location)])
                       , sexp.location);
          }
          // is the next element a list of not-all-symbols?
          sexp[1].forEach(function(arg){
            if (!(arg instanceof symbolExpr)){
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a variable name but found "
                                      , new types.ColoredPart("something else", arg.location)])
                         , sexp.location);
            }
          });
          // is it just (define (<name> <args>))?
          if(sexp.length < 3){
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                            , ": expected an expression for the function body, but nothing's there"])
                         , sexp.location);
          }
          var args = rest(sexp[1]).map(parseIdExpr);
          args.location = sexp[1].location;
          return new defFunc(parseIdExpr(sexp[1][0]), args, parseExpr(sexp[2]), sexp);
      }
      // If it's (define x ...)
      if(sexp[1] instanceof symbolExpr){
          // is it just (define x)?
          if(sexp.length < 3){
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                            , ": expected an expression after the variable "
                                            , new types.ColoredPart(sexp[1].val, sexp[1].location)
                                            , " but nothing's there"])
                         , sexp.location);
          }
          return new defVar(parseIdExpr(sexp[1]), parseExpr(sexp[2]), sexp);
      }
      // If it's (define <invalid> ...)
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a name (or a function name and its variables) "
                                    , " and an expression, but found"
                                    , new types.ColoredPart("something else", sexp[1].location)])
                         , sexp.location);
    }
    function parseValueDef(sexp) {
      // is it just (define-val)?
      if(sexp.length !== 3){
        var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; });
        var wording = (sexp.length<4)? " fewer than two" : new types.MultiPart("more than two parts", extraLocs, false);
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                            , ": expected exactly two parts for the value: a name and an expression"
                            + ", but found"
                            , wording])
           , sexp.location);
      }
      // If it's (define-val x ...)
      if(sexp[1] instanceof symbolExpr){
          // is it just (define-val x)?
          if(sexp.length < 3){
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                            , ": expected an expression after the name "
                                            , new types.ColoredPart(sexp[1].val, sexp[1].location)
                                            , " but nothing's there"])
                         , sexp.location);
          }
          return new defVar(parseIdExpr(sexp[1]), parseExpr(sexp[2]), sexp);
      }
      // If it's (define-val <invalid> ...)
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a name but found "
                                    , new types.ColoredPart("something else", sexp[1].location)])
                         , sexp.location);
    }
    function parseFunDef(sexp) {
      // is it just (define-fun)?
      if(sexp.length !== 3){
        var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; });
        var wording = (sexp.length<4)? " fewer than two" : new types.MultiPart("more than two parts", extraLocs, false);
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected exactly two parts for the function: a header "
                                    + "(function name and variables, in parentheses) and a "
                                    + "body (any expression), but found"
                                    , wording])
                   , sexp.location);
      }
      // If it's (define-fun (...)...)
      if(sexp[1] instanceof Array){
          // is there at least one element?
          if(sexp[1].length === 0){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least a function name within "
                                      , new types.ColoredPart("the parentheses", sexp[1].location)])
                       , sexp.location);
          }
          // is the first element in the list a symbol?
          if(!(sexp[1][0] instanceof symbolExpr)){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a function name after the open parenthesis but found "
                                      , new types.ColoredPart("something else", sexp[1][0].location)])
                       , sexp.location);
          }
          // is the next element a list of not-all-symbols?
          sexp[1].forEach(function(arg){
            if (!(arg instanceof symbolExpr)){
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a variable name, but found "
                                      , new types.ColoredPart("something else", arg.location)])
                         , sexp.location);
            }
          });
          // is it just (define (<name> <args>))?
          if(sexp.length < 3){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                          , ": expected an expression for the function body after "
                                          , new types.ColoredPart("the header", sexp[1].location, false)
                                          , ", but nothing's there"])
                       , sexp.location);
          }
          var args = rest(sexp[1]).map(parseIdExpr);
          args.location = sexp[1].location;
          return new defFunc(parseIdExpr(sexp[1][0]), args, parseExpr(sexp[2]), sexp);
      }
      // If it's (define-fun <invalid> ...)
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a header (function name and variables, in parentheses)"
                                      + " and a body for the function"])
                     , sexp.location);
    }
    var def = isStructDefinition(sexp)    ? parseDefStruct(sexp) :
              isOldDefinition(sexp)       ? parseOldDef(sexp) :
              isMultiValueDefinition(sexp)? parseMultiDef(sexp) :
              isValueDefinition(sexp)     ? parseValueDef(sexp) :
              isFunDefinition(sexp)       ? parseFunDef(sexp) :
              throwError(new types.Message([": expected to find a definition, but found: "+ sexp]),
                         sexp.location);
    def.location = sexp.location;
   return def;
  }


  //////////////////////////////////////// EXPRESSION PARSING ////////////////////////////////
  function isExpr(sexp) {
    return ((!(isDefinition(sexp))) && (!(isRequire(sexp))) && (!(isProvide(sexp))));
  }

  function parseExpr(sexp) {
    return isCons(sexp) ? parseExprList(sexp) :
    parseExprSingleton(sexp);
  }

  // parseExprList : SExp -> AST
  // predicates and parsers for call, lambda, local, letrec, let, let*, if, and, or, quote and quasiquote exprs
  function parseExprList(sexp) {
    function parseFuncCall(sexp) {
      if(isSymbolEqualTo(sexp[0], "unquote")){
        throwError(new types.Message(["misuse of a comma or 'unquote, not under a quasiquoting backquote"])
                   , sexp.location
                   , "Error-GenericSyntacticError");
      }
      if(isSymbolEqualTo(sexp[0], "unquote-splicing")){
        throwError(new types.Message(["misuse of a ,@ or unquote-splicing, not under a quasiquoting backquote"])
                   , sexp.location
                   , "Error-GenericSyntacticError");
      }
      if(isSymbolEqualTo(sexp[0], "else")){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp.location)
                                      , ": not allowed "
                                      , new types.ColoredPart("here", sexp.location)
                                      , ", because this is not a question in a clause"])
                   , sexp.location);
      }
      return isCons(sexp)? new callExpr(parseExpr(sexp[0]), rest(sexp).map(parseExpr), sexp[0]) :
                            throwError(new types.Message(["function call sexp"]), sexp.location);
    }
    function parseLambdaExpr(sexp) {
      // is it just (lambda)?
      if(sexp.length === 1){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one variable (in parentheses) after lambda, but nothing's there"]),
                    sexp.location);
      }
      // is it just (lambda <not-list>)?
      if(!(sexp[1] instanceof Array)){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one variable (in parentheses) after lambda, but found "
                                      , new types.ColoredPart("something else", sexp[1].location)]),
                    sexp.location);
      }
      // is it a list of not-all-symbols?
      sexp[1].forEach(function(arg){
        if (!(arg instanceof symbolExpr)){
          var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                       , ": expected a list of variables after lambda, but found "
                                       , new types.ColoredPart("something else", arg.location)]);
          throwError(msg, sexp.location);
        }
      });
      // is it just (lambda (x))?
      if(sexp.length === 2){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected an expression for the function body, but nothing's there"]),
                    sexp.location);
      }
      // too many expressions?
      if(sexp.length > 3){
        var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts"),
            msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected only one expression for the function body, but found "
                                     , new types.MultiPart(wording, extraLocs, false)]);
        throwError(msg, sexp.location);
      }
      var args = sexp[1].map(parseIdExpr);
      args.location = sexp[1].location;
      return new lambdaExpr(args, parseExpr(sexp[2]), sexp[0]);
    }
    function parseLocalExpr(sexp) {
      // is it just (local)?
      if(sexp.length === 1){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected at least one definition (in square brackets) after local,"
                                        + " but nothing's there"]),
                    sexp.location);
      }
      // is it just (local <not-list>)?
      if(!(sexp[1] instanceof Array)){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a collection of definitions, but given "
                                        , new types.ColoredPart("something else", sexp[1].location)]),
                    sexp[1].location);
      }
      // is it a list of not-all-definitions?
      sexp[1].forEach(function(def){
        if (!isDefinition(def)){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a definition, but given "
                                        , new types.ColoredPart("something else", def.location)]),
                     def.location);
        }
      });
      // is it just (local [...defs...] ))?
      if(sexp.length === 2){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found none"]),
                     sexp.location);
      }
      // too many expressions?
      if(sexp.length > 3){
        var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                     sexp.location);
      }
      return new localExpr(sexp[1].map(parseDefinition), parseExpr(sexp[2]), sexp[0]);
    }
    function parseLetrecExpr(sexp) {
      // is it just (letrec)?
      if(sexp.length < 3){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected an expression after the bindings, but nothing's there"]),
                     sexp.location);
      }
      // is it just (letrec <not-list>)?
      if(!(sexp[1] instanceof Array)){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a key/value pair, but given "
                                      , new types.ColoredPart("something else", sexp[1].location)]),
                     sexp.location);
      }
      // is it a list of not-all-bindings?
      sexp[1].forEach(function(binding){
        if (!sexpIsCouple(binding)){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a key/value pair, but given "
                                        , new types.ColoredPart("something else", binding.location)]),
                     binding.location);
        }
      });
      // is it just (letrec (...bindings...) ))?
      if(sexp.length === 2){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected an expression after the bindings, but nothing's there"]),
                     sexp.location);
      }
      // too many expressions?
      if(sexp.length > 3){
        var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                     sexp.location);
      }
      return new letrecExpr(sexp[1].map(parseBinding), parseExpr(sexp[2]), sexp[0]);
    }
    function parseLetExpr(sexp) {
      // is it just (let)?
      if(sexp.length === 1){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one binding (in parentheses) after let, but nothing's there"]),
                     sexp.location);
      }
      // is it just (let <not-list>)?
      if(!(sexp[1] instanceof Array)){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected sequence of key value pairs, but given "
                                      , new types.ColoredPart("something else", sexp[1].location)]),
                     sexp[1].location);
      }
      // is it a list of not-all-bindings?
      sexp[1].forEach(function(binding){
        if (!sexpIsCouple(binding)){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a key/value pair, but given "
                                      , new types.ColoredPart("something else", binding.location)]),
                     binding.location);
        }
      });
      // too many expressions?
      if(sexp.length > 3){
        var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                     sexp.location);
      }
      // is it just (let (...bindings...) ))?
      if(sexp.length === 2){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found none"]),
                     sexp.location);
      }
      return new letExpr(sexp[1].map(parseBinding), parseExpr(sexp[2]), sexp);
    }
    function parseLetStarExpr(sexp) {
      // is it just (let*)?
      if(sexp.length === 1){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected an expression after the bindings, but nothing's there"]),
                     sexp.location);
      }
      // is it just (let* <not-list>)?
      if(!(sexp[1] instanceof Array)){
        var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                     , ": expected sequence of key/value pairs, but given "
                                     , new types.ColoredPart("something else", sexp[1].location)]);
        throwError(msg, sexp.location);
      }
      // is it a list of not-all-bindings?
      sexp[1].forEach(function(binding){
        if (!sexpIsCouple(binding)){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a key/value pair, but given "
                                      , new types.ColoredPart("something else", binding.location)]),
                     binding.location);
        }
      });
      // is it just (let* (...bindings...) ))?
      if(sexp.length === 2){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found none"]),
                     sexp.location);
      }
      // too many expressions?
      if(sexp.length > 3){
        var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                    sexp.location);
      }
      var bindings = sexp[1].map(parseBinding);
      bindings.location = sexp[1].location;
      return new letStarExpr(bindings, parseExpr(sexp[2]), sexp[0]);
    }
    function parseIfExpr(sexp) {
      // Does it have too few parts?
      if(sexp.length < 4){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a test, a consequence, and an alternative, but all three were not found"]),
                    sexp.location);
      }
      // Does it have too many parts?
      if(sexp.length > 4){
        var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; });
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected only a test, a consequence, and an alternative, "
                                      , "but found "
                                      , new types.MultiPart("more than three of these", extraLocs, false)]),
                    sexp.location);
      }
      return new ifExpr(parseExpr(sexp[1]), parseExpr(sexp[2]), parseExpr(sexp[3]), sexp[0]);
    }
    function parseBeginExpr(sexp) {
      // is it just (begin)?
      if(sexp.length < 2){
        var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                     , ": Inside a begin, expected to find a body, but nothing was found."]);
        throwError(msg, sexp.location);
      }
      return new beginExpr(rest(sexp).map(parseExpr), sexp[0]);
    }
    function parseAndExpr(sexp) {
      // and must have 2+ arguments
      if(sexp.length < 3){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least 2 arguments, but given "
                                      , (sexp.length===1)? "0" : new types.ColoredPart((sexp.length-1).toString(),
                                                                                       sexp[1].location)]),
                    sexp.location);
      }
      return new andExpr(rest(sexp).map(parseExpr), sexp[0]);
    }
    function parseOrExpr(sexp) {
      // or must have 2+ arguments
      if(sexp.length < 3){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least 2 arguments, but given "
                                      , (sexp.length===1)? "0" : new types.ColoredPart((sexp.length-1).toString(),
                                                                                       sexp[1].location)]),
                    sexp.location);
      }
      var orEx = new orExpr(rest(sexp).map(parseExpr), sexp[0]);
      return orEx;
    }
    function parseQuotedExpr(sexp) {

      function parseQuotedItem(sexp) {
        return isCons(sexp) ? sexp.map(parseQuotedItem)
          :  (sexp instanceof Array && sexp.length === 0)? sexp // the empty list is allowed inside quotes
          : /* else */ parseExprSingleton(sexp);
      }
      // quote must have exactly one argument
      if(sexp.length < 2){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single argument, but did not find one."]),
                    sexp.location);
      }
      if(sexp.length > 2){
        var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; });
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single argument, but found "
                                      , new types.MultiPart("more than one.", extraLocs, false)]),
                    sexp.location);
      }
      return new quotedExpr(parseQuotedItem(sexp[1]));
    }

    return (function () {
        var peek = sexp[0];
        var expr = !(isSymbol(peek)) ? parseFuncCall(sexp) :
                    isSymbolEqualTo("λ", peek)       ? parseLambdaExpr(sexp) :
                    isSymbolEqualTo("lambda", peek)  ? parseLambdaExpr(sexp) :
                    isSymbolEqualTo("local", peek)   ? parseLocalExpr(sexp) :
                    isSymbolEqualTo("letrec", peek)  ? parseLetrecExpr(sexp) :
                    isSymbolEqualTo("let", peek)     ? parseLetExpr(sexp) :
                    isSymbolEqualTo("let*", peek)    ? parseLetStarExpr(sexp) :
                    isSymbolEqualTo("cond", peek)    ? parseCondExpr(sexp) :
                    isSymbolEqualTo("case", peek)    ? parseCaseExpr(sexp) :
                    isSymbolEqualTo("if", peek)      ? parseIfExpr(sexp) :
                    isSymbolEqualTo("begin", peek)   ? parseBeginExpr(sexp) :
                    isSymbolEqualTo("and", peek)     ? parseAndExpr(sexp) :
                    isSymbolEqualTo("or", peek)      ? parseOrExpr(sexp) :
                    isSymbolEqualTo("when", peek)    ? parseWhenUnlessExpr(sexp) :
                    isSymbolEqualTo("unless", peek)  ? parseWhenUnlessExpr(sexp) :
                    isSymbolEqualTo("quote", peek)   ? parseQuotedExpr(sexp) :
                    isSymbolEqualTo("quasiquote", peek)       ? parseQuasiQuotedExpr(sexp) :
                    isSymbolEqualTo("unquote", peek)          ? parseUnquoteExpr(sexp) :
                    isSymbolEqualTo("unquote-splicing", peek) ? parseUnquoteSplicingExpr(sexp) :
                    parseFuncCall(sexp);
          expr.location = sexp.location;
          return expr;
   })();
  }
 
  function parseWhenUnlessExpr(sexp){
    // is it just (when)?
    if(sexp.length < 3){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at a test and at least one result after "+sexp[0]+", but nothing's there"]),
                    sexp.location);
    }
    var exprs = sexp.slice(2), result = new whenUnlessExpr(parseExpr(sexp[1]), parse(exprs), sexp[0]);
    exprs.location = exprs[0].location; // FIXME: merge the locations
    result.location = sexp.location;
    return result;
  }

  function parseCondExpr(sexp) {
    // is it just (cond)?
    if(sexp.length === 1){
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one clause after cond, but nothing's there"]),
                    sexp.location);
    }
    var condLocs = [sexp[0].location, sexp.location.start(), sexp.location.end()];
 
    function isElseClause(couple){ return isSymbol(couple[0]) && isSymbolEqualTo(couple[0], "else"); }
 
    function checkCondCouple(clause) {
      var clauseLocations = [clause.location.start(), clause.location.end()];
      // is it (cond ...<not-a-clause>..)?
      if(!(clause instanceof Array)){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, condLocs, true)
                                      , ": expected a clause with a question and an answer, but found "
                                      , new types.ColoredPart("something else", clause.location)]),
                    clause.location);
      }
      if(clause.length === 0){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, condLocs, true)
                                      , ": expected a clause with a question and an answer, but found an "
                                      , new types.MultiPart("empty part", clauseLocations, true)]),
                    clause.location);
      }
      if(clause.length === 1){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, condLocs, true)
                                      , ": expected a clause with a question and an answer, but found a "
                                      , new types.MultiPart("clause", clauseLocations, true)
                                      , " with only "
                                      , new types.MultiPart("one part", [clause[0].location], false)]),
                    clause.location);
      }
      if(clause.length > 2){
        var extraLocs = clause.map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" parts";
        throwError(new types.Message([new types.MultiPart(sexp[0].val, condLocs, true)
                                      , ": expected a clause with a question and an answer, but found "
                                      , new types.MultiPart("a clause", clauseLocations, true)
                                      , " with "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                    clause.location);
      }
    }
 
 
    function parseCondCouple(clause) {
        var test = parseExpr(clause[0]), result = parseExpr(clause[1]), cpl = new couple(test, result);
        // the only un-parenthesized keyword allowed in the first slot is 'else'
        if((plt.compiler.keywords.indexOf(test.val) > -1) && (test.val !== "else")){
          throwError(new types.Message([new types.ColoredPart(test.val, test.location)
                                        , ": expected an open parenthesis before "
                                        , test.val
                                        , ", but found none"]),
                     test.location);
        }
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = clause.location;
        return cpl;
    }

    // first check the couples, then parse if there's no problem
    rest(sexp).forEach(checkCondCouple);
    var numClauses = rest(sexp).length,
        parsedClauses = rest(sexp).map(parseCondCouple);
    // if we see an else and we haven't seen all other clauses first
    // throw an error that points to the next clause (rst + the one we're looking at + "cond")
    rest(sexp).forEach(function(couple, idx){
     if(isElseClause(couple) && (idx < (numClauses-1))){
       throwError(new types.Message([new types.MultiPart("cond", condLocs, true)
                                     , ": ", "found an "
                                     , new types.ColoredPart("else clause", couple.location)
                                     , " that isn't the last clause in its cond expression; there is "
                                     , new types.ColoredPart("another clause", sexp[idx+2].location)
                                     , " after it"]),
                  couple.location);
      }
    });
    return new condExpr(parsedClauses, sexp[0]);
  }

  function parseCaseExpr(sexp) {
    // is it just (case)?
    if(sexp.length === 1){
        var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                     , ": expected at least one clause after case, but nothing's there"]);
        throwError(msg, sexp.location);
    }
    var caseLocs = [sexp[0].location, sexp.location.start(), sexp.location.end()];
    if(sexp.length === 2){
        var msg = new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                    , ": expected a clause with at least one choice (in parentheses)"
                                     + " and an answer after the expression, but nothing's there"]);
        throwError(msg, sexp.location);
    }
 
    function checkCaseCouple(clause) {
      var clauseLocations = [clause.location.start(), clause.location.end()];
      if(!(clause instanceof Array)){
        var msg = new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                     , ": expected a clause with at least one choice (in parentheses), but found "
                                     , new types.ColoredPart("something else", clause.location)]);
        throwError(msg, sexp.location);
      }
      if(clause.length === 0){
        var msg = new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                     , ": expected at least one choice (in parentheses) and an answer, but found an "
                                     , new types.ColoredPart("empty part", clause.location)]);
        throwError(msg, sexp.location);
      }
      if(!( (clause[0] instanceof Array) ||
            ((clause[0] instanceof symbolExpr) && isSymbolEqualTo(clause[0], "else")))){
        var msg = new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                     , ": expected 'else', or at least one choice in parentheses, but found "
                                     , new types.ColoredPart("something else", clause.location)]);
        throwError(msg, sexp.location);
      }
      if(clause.length === 1){
        var msg = new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                     , ": expected a clause with a question and an answer, but found a "
                                     , new types.MultiPart("clause", clauseLocations, true)
                                     , " with only "
                                     , new types.ColoredPart("one part", clause[0].location)]);
        throwError(msg, sexp.location);
      }
      if(clause.length > 2){
        var extraLocs = clause.map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" parts",
            msg = new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                     , ": expected only one expression for the answer in the case clause, but found a "
                                     , new types.MultiPart("clause", clauseLocations, true)
                                     , " with "
                                     , new types.MultiPart(wording, extraLocs, false)]);
        throwError(msg, sexp.location);
      }
    }
 
    // is this sexp actually an else clause?
    function isElseClause(sexp){ return isSymbol(sexp[0]) && (sexp[0].val==="else");}

    // read the first item in the clause as a quotedExpr, and parse the second
    // if it's an else clause, however, leave it alone
    function parseCaseCouple(sexp) {
        var test = isElseClause(sexp)? sexp[0] : new quotedExpr(sexp[0]),
            result = parseExpr(sexp[1]), cpl = new couple(test, result);
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = sexp.location;
        return cpl;
    }
 
    var clauses = sexp.slice(2);
    // first check the couples, then parse if there's no problem
    clauses.forEach(checkCaseCouple);
    var numClauses = clauses.length,
        parsedClauses = clauses.map(parseCaseCouple);

    // if we see an else and we haven't seen all other clauses first
    // throw an error that points to the next clause (rst + the one we're looking at + "cond")
    clauses.forEach(function(couple, idx){
     if(isElseClause(couple) && (idx < (numClauses-1))){
        var msg = new types.Message([new types.MultiPart("case", caseLocs, true)
                                     , ": found an "
                                     , new types.ColoredPart("else clause", couple.location)
                                     , "that isn't the last clause in its case expression; there is "
                                     , new types.ColoredPart("another clause", sexp[idx+2].location)
                                     , " after it"]);
        throwError(msg, sexp.location);
      }
    });
    return new caseExpr(parseExpr(sexp[1]), parsedClauses, sexp[0]);
  }
 
  function parseBinding(sexp) {
    if(sexpIsCouple(sexp)){
        var binding = new couple(parseIdExpr(sexp[0]), parseExpr(sexp[1]));
        binding.location = sexp.location;
        binding.stx = sexp;
        return binding;
    } else {
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a sequence of key/value pairs, but given "
                                      , new types.ColoredPart("something else", sexp[0].location)]),
                   sexp.location);
    }
  }

  function parseUnquoteExpr(sexp, depth) {
    if (typeof depth === 'undefined') {
      throwError( new types.Message(["misuse of a comma or 'unquote, not under a quasiquoting backquote"])
                , sexp.location
                , "Error-GenericSyntacticError");
    } else if((sexp.length !== 2)){
     throwError( new types.Message(["Inside an unquote, expected to find a single argument, but found "+(sexp.length-1)])
               , sexp.location);
   } else if (depth === 1) {
     var result = new unquotedExpr(parseExpr(sexp[1]))
     result.location = sexp[1].location
     return result;
   } else if (depth > 1) {
     var result = new unquotedExpr(parseQuasiQuotedItem(sexp[1], depth-1))
     result.location = sexp[1].location
     return result;
   } else {
     throwError( new types.Message(["ASSERTION FAILURE: depth should have been undefined, or a natural number"])
               , sexp.location);
   }
  }

  function parseUnquoteSplicingExpr(sexp, depth) {
    if (typeof depth === 'undefined') {
      throwError( new types.Message(["misuse of a ,@ or unquote-splicing, not under a quasiquoting backquote"])
                , sexp.location
                , "Error-GenericSyntacticError");
    } else if((sexp.length !== 2)){
      throwError(new types.Message(["Inside an unquote-splicing, expected to find a single argument, but found "+(sexp.length-1)])
                 , sexp.location);
    } else if (depth === 1) {
      var result =  new unquoteSplice(parseExpr(sexp[1]))
      result.location = sexp[1].location
      return result;
    } else if (depth > 1) {
      var result =  new unquoteSplice(parseQuasiQuotedItem(sexp[1], depth-1))
      result.location = sexp[1].location
      return result;
    } else {
     throwError( new types.Message(["ASSERTION FAILURE: depth should have been undefined, or a natural number"])
               , sexp.location);
    }
  }

  /* This is what we use in place of `parseExpr` when we're in "data-mode",  */
  /* i.e. there's an active quasiquote. Active is a bit awkward to describe, */
  /* but basically it's an unmatch quasiquote, if we think of unquotes as    */
  /* matching quasiquotes, so:                                               */
  /*   ``,(+ 1 2)                                                            */
  /* has an active quasiquote while reading (+ 1 2), whereas:                */
  /*   ``,,(+ 1 2)                                                           */
  /* does not.                                                               */
  function parseQuasiQuotedItem(sexp, depth) {
    if (isCons(sexp) && sexp[0].val === 'unquote'){
      return parseUnquoteExpr(sexp, depth);
    } else if(isCons(sexp) && sexp[0].val === 'unquote-splicing'){
      return parseUnquoteSplicingExpr(sexp, depth);
    } else if(isCons(sexp) && sexp[0].val === 'quasiquote'){
      return parseQuasiQuotedExpr(sexp, depth);
    } else if(isCons(sexp)){
       var res = sexp.map(function (x) {return parseQuasiQuotedItem(x, depth)});
       res.location = sexp.location;
       return res;
    } else if( depth === 0){
      return parseExpr(sexp);
    } else {
      return (function () {
              var res = new quotedExpr(sexp);
              res.location=sexp.location;
              return res;})()
    }

  }

  function parseQuasiQuotedExpr(sexp, depth) {
    depth = (typeof depth === 'undefined') ? 0 : depth;
    // quasiquote must have exactly one argument
    if(sexp.length < 2){
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a single argument, but did not find one "]),
                  sexp.location);
    }
    if(sexp.length > 2){
      var extraLocs = sexp.slice(1).map(function(sexp){ return sexp.location; });
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a single argument, but found "
                                    , new types.MultiPart("more than one.", extraLocs, false)]),
                  sexp.location);
    }
    // if the argument is (unquote-splicing....), throw an error
    if(isCons(sexp[1]) && isSymbolEqualTo(sexp[1][0], "unquote-splicing")){
      throwError(new types.Message(["misuse of ,@ or `unquote-splicing' within a quasiquoting backquote"]), sexp.location);
    }

    var quoted = parseQuasiQuotedItem(sexp[1], depth+1);
    quoted.location = sexp[1].location;
    var result = new quasiquotedExpr(quoted);
    result.location = sexp.location;
    return result;
  }
 
  // replace all undefineds with the last sexp, and convert to a function call
  function parseVector(sexp){
    function buildZero(){
      var lit = new literal(0);
      lit.location = sexp.location;
      return lit;
    }
    var unParsedVector = sexp.val,
        vals = parseStar(unParsedVector.elts.filter(function(e){return e!==undefined;})),
        last = (vals.length===0)? buildZero() : vals[vals.length-1], // if they're all undefined, use 0
        elts = unParsedVector.elts.map(function(v){return (v===undefined)? last : parseExpr(v);});
    var vectorFunc = new symbolExpr("vector"),
        buildVector = new callExpr(vectorFunc, elts);
    vectorFunc.location = buildVector.location = sexp.location;
    return buildVector;
  }
  
  function parseExprSingleton(sexp) {
    var singleton = isUnsupported(sexp) ? sexp :
                    isVector(sexp)  ? parseVector(sexp) :
                    isSymbol(sexp) ? sexp :
                    isLiteral(sexp) ? sexp :
                    isSymbolEqualTo("quote", sexp) ? new quotedExpr(sexp) :
                    isSymbolEqualTo("empty", sexp) ? new callExpr(new symbolExpr("list"), []) :
                    new callExpr(null, []);
/*      throwError(new types.Message([new types.ColoredPart("( )", sexp.location)
                                    , ": expected a function, but nothing's there"])
                 , sexp.location);
*/
   singleton.location = sexp.location;
   return singleton;
  }

  function parseIdExpr(sexp) {
    return isSymbol(sexp) ? sexp :
    throwError(new types.Message(["ID"]), sexp.location);
  }

  function isTupleStartingWithOfLength(sexp, symbol, n) {
    return ((isCons(sexp)) && (sexp.length === n) && (isSymbol(sexp[0])) && (isSymbolEqualTo(sexp[0], symbol)));
  }

  function sexpIsCouple(sexp) {
    return ((isCons(sexp)) && ((sexp.length === 2)));
  }

  function sexpIsCondListP(sexp) {
    return ((isCons(sexp)) && (sexp.length >= 2) && (isSymbol(sexp[0])) && (isSymbolEqualTo(sexp[0], "cond")));
  }

  //////////////////////////////////////// REQUIRE PARSING ////////////////////////////////
  function isRequire(sexp) {
    return isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "require");
  }

  function parseRequire(sexp) {
    // is it (require)?
    if(sexp.length < 2){
      var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                   , ": expected a module name after `require', but found nothing"]);
      throwError(msg, sexp.location);
    }
    // if it's (require (lib...))
    if((sexp[1] instanceof Array) && isSymbolEqualTo(sexp[1][0], "lib")){
        // is it (require (lib)) or (require (lib <string>))
        if(sexp[1].length < 3){
          var partsNum = sexp[1].slice(1).length,
              partsStr = partsNum + ((partsNum===1)? " part" : " parts"),
              msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least two strings after "
                                      , new types.ColoredPart("lib", sexp[1][0].location)
                                      , " but found only "
                                      , partsStr]);
           throwError(msg, sexp.location);
        }
        // is it (require (lib not-strings))?
        rest(sexp[1]).forEach(function(lit){
          if (!(isString(lit))){
            var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a string for a library collection, but found "
                                        , new types.ColoredPart("something else", str.location)]);
            throwError(msg, sexp.location);
          }
         });
    // if it's (require (planet...))
    } else if((sexp[1] instanceof Array) && isSymbolEqualTo(sexp[1][0], "planet")){
      var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                   , ": Importing PLaneT pacakges is not supported at this time"]);
      throwError(msg, sexp.location);
    // if it's (require <not-a-string-or-symbol>)
    } else if(!((sexp[1] instanceof symbolExpr) || isString(sexp[1]))){
      var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                   , ": expected a module name as a string or a `(lib ...)' form, but found "
                                   , new types.ColoredPart("something else", sexp[1].location)]);
      throwError(msg, sexp.location);
    }
    var req = new requireExpr(sexp[1], sexp[0]);
    req.location = sexp.location;
    return req;
  }

  //////////////////////////////////////// PROVIDE PARSING ////////////////////////////////
 function isProvide(sexp) {
    return isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "provide");
 }
 function parseProvide(sexp) {
    var clauses = rest(sexp).map(function(p){
        // symbols are ok
        if(p instanceof symbolExpr){ return p;}
        // (struct-out sym) is ok
        if((p instanceof Array) && (p.length == 2)
           && (p[0] instanceof symbolExpr) && isSymbolEqualTo(p[0], "struct-out")
           && (p[1] instanceof symbolExpr)){
          return p;
        }
        // everything else is NOT okay
        var msg = new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                     , ": I don't recognize the syntax of this "
                                     , new types.ColoredPart("clause", p.location)]);
        throwError(msg, sexp.location);
    });
    var provide = new provideStatement(clauses, sexp[0]);
    provide.location = sexp.location;
    return provide;
  }

  /////////////////////
  /* Export Bindings */
  /////////////////////
 plt.compiler.parse = function(sexp, debug){
      var start = new Date().getTime();
      try{ var AST = parse(sexp); AST.location = sexp.location; }   // do the actual work
      catch(e) { console.log("PARSING ERROR"); throw e; }
      var end = new Date().getTime();
      if(debug){
        console.log("Parsed in "+(Math.floor(end-start))+"ms");
        console.log(AST);
      }
      return AST;
  };
})();
