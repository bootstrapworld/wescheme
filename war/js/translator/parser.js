// if not defined, declare the compiler object as part of plt
if(typeof(plt) === "undefined")          plt = {};
if(typeof(plt.compiler) === "undefined") plt.compiler = {};

/*
 
 //////////////////////////////////////////////////////////////////////////////
 ///////////////////////////////// PARSER OBJECT //////////////////////////////
 //////////////////////////////////////////////////////////////////////////////
 
 Parser for http://docs.racket-lang.org/htdp-langs/intermediate-lam.html
 
 * Given an Array of SExps, produce an array of Programs or a structured error
 * see structures.js for Program Objects and Error throwing
 
 TODO
 - assign location in constructors
 - JSLint
 - parse define-values
 */

(function () {
 'use strict';
 
 //////////////////////////////////// UTILITY FUNCTIONS //////////////////////////////
 function isVector(x) { return types.isVector(x.val); }
 function isString(x) { return types.isString(x.val); }
 function isSymbol(x) { return x instanceof symbolExpr; }
 function isLiteral(x){ return x instanceof literal; }
 function isUnsupported(x){ return x instanceof unsupportedExpr;}
 
 // isSymbolEqualTo : symbolExpr symbolExpr -> Boolean
 // are these all symbols of the same value?
 function isSymbolEqualTo(x, y) {
    x = (x instanceof symbolExpr)? x.val : x;
    y = (y instanceof symbolExpr)? y.val : y;
    return x === y;
 }
 
 function isCons(x)  { return x instanceof Array && x.length>=1;}
 function rest(ls)   { return ls.slice(1); }
 
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
  function isValueDefinition(sexp) {
    return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define", sexp[0]));
  }

  // is it any kind of definition?
  function isDefinition(sexp) {
    return isStructDefinition(sexp) || isValueDefinition(sexp);
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
      return new defStruct(parseIdExpr(sexp[1]), sexp[2].map(parseIdExpr), sexp[0]);
    }
    function parseDef(sexp) {
      // is it just (define)?
      if(sexp.length < 2){
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a variable, or a function name and its variables "
                                      + "(in parentheses), after define, but nothing's there"])
                     , sexp.location);
      }
      // If it's (define (...)...)
      if(sexp[1] instanceof Array){
          // is there at least one element?
          if(sexp[1].length === 0){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a name for the function within "
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
                                      , ": expected a variable but found "
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
          // too many parts?
          if(sexp.length > 3){
              var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
                  wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                            , ": expected only one expression for the function body"
                                            + ", but found "
                                            , new types.MultiPart(wording, extraLocs, false)])
                         , sexp.location);
          }
          return new defFunc(parseIdExpr(sexp[1][0]), rest(sexp[1]).map(parseIdExpr), parseExpr(sexp[2]), sexp);
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
          // too many parts?
          if(sexp.length > 3){
              var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
                  wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
              throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                            , ": expected only one expression after the variable "
                                            , new types.ColoredPart(sexp[1].val, sexp[1].location)
                                            , ", but found "
                                            , new types.MultiPart(wording, extraLocs, false)])
                         , sexp.location);
          }
          return new defVar(parseIdExpr(sexp[1]), parseExpr(sexp[2]), sexp);
      }
      // If it's (define <invalid> ...)
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a variable but found "
                                    , new types.ColoredPart("something else", sexp[1].location)])
                         , sexp.location);
    }
    var def = isStructDefinition(sexp) ? parseDefStruct(sexp) :
              isValueDefinition(sexp) ? parseDef(sexp) :
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
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a list of variables after lambda, but found "
                                        , new types.ColoredPart("something else", arg.location)]),
                    sexp.location);
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
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected only one expression for the function body, but found "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                    sexp.location);
      }
      return new lambdaExpr(sexp[1].map(parseIdExpr), parseExpr(sexp[2]), sexp[0]);
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
      // too many expressions?
      if(sexp.length > 3){
        var extraLocs = sexp.slice(3).map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" extra "+((extraLocs.length === 1)? "part" : "parts");
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a single body, but found "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                     sexp.location);
      }
      // is it just (let <not-list>)?
      if(!(sexp[1] instanceof Array) || (sexp[1].length < 1)){
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
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected sequence of key/value pairs, but given "
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
      return new letStarExpr(sexp[1].map(parseBinding), parseExpr(sexp[2]), sexp[0]);
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
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": Inside a begin, expected to find a body, but nothing was found."]),
                    sexp.location);
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
      // quote must have exactly one argument
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
      return new quotedExpr(sexp[1]);
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
                    isSymbolEqualTo("quote", peek)   ? parseQuotedExpr(sexp) :
                    isSymbolEqualTo("quasiquote", peek) ? parseQuasiQuotedExpr(sexp, 1) :
                    parseFuncCall(sexp);
          expr.location = sexp.location;
          return expr;
   })();
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
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = clause.location;
        return cpl;
    }

    // first check the couples, then parse if there's no problem
    rest(sexp).forEach(checkCondCouple);
    var numClauses = rest(sexp).length,
        parsedClauses = rest(sexp).reduce(function (rst, couple) {
                                            return rst.concat([parseCondCouple(couple)]);
                                          }, []);
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
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected at least one clause after case, but nothing's there"]),
                    sexp.location);
    }
    var caseLocs = [sexp[0].location, sexp.location.start(), sexp.location.end()];
    if(sexp.length === 2){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                      , ": expected a clause with at least one choice (in parentheses)"
                                      + " and an answer after the expression, but nothing's there"]),
                    sexp.location);
    }
                                                                  
    function isElseClause(couple){ return isSymbol(couple[0]) && isSymbolEqualTo(couple[0], "else");}

    function checkCaseCouple(clause) {
      var clauseLocations = [clause.location.start(), clause.location.end()];
      if(!(clause instanceof Array)){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                      , ": expected a clause with at least one choice (in parentheses), but found "
                                      , new types.ColoredPart("something else", clause.location)]),
                    sexp.location);
      }
      if(clause.length === 0){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                      , ": expected at least one choice (in parentheses) and an answer, but found an "
                                      , new types.ColoredPart("empty part", clause.location)]),
                    sexp.location);
      }
      if(!( (clause[0] instanceof Array) ||
            ((clause[0] instanceof symbolExpr) && isSymbolEqualTo(clause[0], "else")))){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                      , ": expected 'else', or at least one choice in parentheses, but found "
                                      , new types.ColoredPart("something else", clause.location)]),
                    sexp.location);
      }
      if(clause.length === 1){
        throwError(new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                      , ": expected a clause with a question and an answer, but found a "
                                      , new types.MultiPart("clause", clauseLocations, true)
                                      , " with only "
                                      , new types.ColoredPart("one part", clause[0].location)]),
                    sexp.location);
      }
      if(clause.length > 2){
        var extraLocs = clause.map(function(sexp){ return sexp.location; }),
            wording = extraLocs.length+" parts";
        throwError(new types.Message([new types.MultiPart(sexp[0].val, caseLocs, true)
                                      , ": expected only one expression for the answer in the case clause, but found a "
                                      , new types.MultiPart("clause", clauseLocations, true)
                                      , " with "
                                      , new types.MultiPart(wording, extraLocs, false)]),
                   sexp.location);
      }
    }
 
    function parseCaseCouple(clause) {
        var test = parseExpr(clause[0]), result = parseExpr(clause[1]), cpl = new couple(test, result);
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = clause.location;
        return cpl;
    }
 
    // first check the couples, then parse if there's no problem
    sexp.slice(2).forEach(checkCaseCouple);
    var numClauses = sexp.slice(2).length,
        parsedClauses = sexp.slice(2).reduce(function (rst, couple) {
                                            return rst.concat([parseCaseCouple(couple)]);
                                          }, []);
    // if we see an else and we haven't seen all other clauses first
    // throw an error that points to the next clause (rst + the one we're looking at + "cond")
    sexp.slice(2).forEach(function(couple, idx){
     if(isElseClause(couple) && (idx < (numClauses-1))){
            throwError(new types.Message([new types.MultiPart("case", caseLocs, true)
                                          , ": found an "
                                          , new types.ColoredPart("else clause", couple.location)
                                          , "that isn't the last clause in its case expression; there is "
                                          , new types.ColoredPart("another clause", sexp[idx+2].location)
                                          , " after it"]),
                       sexp.location);
      }
    });
    return new caseExpr(parseExpr(sexp[1]), parsedClauses, sexp[0]);
  }
 
  function parseBinding(sexp) {
    return sexpIsCouple(sexp) ? new couple(parseIdExpr(sexp[0]), parseExpr(sexp[1])) :
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                      , ": expected a sequence of key/value pairs, but given "
                                      , new types.ColoredPart("something else", sexp[0].location)]),
                   sexp.location);
  }

  function parseQuasiQuotedExpr(sexp, depth) {
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
 
    // when parsing an element inside a quasiquoted list, check for use of quasiquote, unquote and unquote-splicing
    // Track depth so we can throw parse errors
    function parseQqListItem(sexp) {
      if(isCons(sexp) && isSymbolEqualTo(sexp[0], "unquote-splicing")){
        if((sexp.length !== 2)){
          throwError(new types.Message(["Inside an unquote-splicing, expected to find a single argument, but found "+(sexp.length-1)])
                     , sexp.location);
        } else if(depth === 0){
          throwError(new types.Message(["misuse of a , or 'unquote, not under a quasiquoting backquote"])
                     , sexp.location);
        }
        // decrement depth no matter what. If, AFTER decrementing, we are at depth==0, return a real quasiquote
        if((depth-1) === 0){
          return new unquoteSplice(parseExpr(sexp[1]));
        }
      } else if(isCons(sexp) && isSymbolEqualTo(sexp[0], "unquote")){
        if((sexp.length !== 2)){
          throwError(new types.Message(["Inside an unquote, expected to find a single argument, but found "+(sexp.length-1)])
                     , sexp.location);
        } else if(depth === 0){
          throwError(new types.Message(["misuse of a ,@ or 'unquote, not under a quasiquoting backquote"])
                     , sexp.location);
        }
        if((depth-1) === 0){
          return new unquotedExpr(parseExpr(sexp[1]));
        }
      } else if(isCons(sexp) && isSymbolEqualTo(sexp[0], "quasiquote")){
        if((sexp.length !== 2))
          throwError(new types.Message(["Inside an quasiquote, expected to find a single argument, but found "+(sexp.length-1)])
                     , sexp.location);
        // increment depth no matter what. If, AFTER incrementing, we are at depth==0, return a real quasiquote
        depth++;
        if(depth === 0){
          return parseQuasiQuotedExpr(sexp, depth);
        }
      }
      // otherwise, parse using standard behavior
      if(isCons(sexp)) return sexp.map(parseQqListItem);
      else return sexp;
    }
    return new quasiquotedExpr(isCons(sexp[1])? sexp[1].map(parseQqListItem) : sexp[1]);
  }
 
  // replace all undefineds with the last sexp, and convert to a function call
  function parseVector(sexp){
    var unParsedVector = sexp.val,
        vals = parseStar(unParsedVector.elts.filter(function(e){return e!==undefined;})),
        last = (vals.length===0)? new literal(0) : vals[vals.length-1], // if they're all undefined, use 0
        elts = unParsedVector.elts.map(function(v){return (v===undefined)? last : v;});
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
      throwError(new types.Message([new types.ColoredPart("( )", sexp.location)
                                    , ": expected a function, but nothing's there"])
                 , sexp.location);
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
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a module name after `require', but found nothing"]),
                 sexp.location);
    }
    // if it's (require (lib...))
    if((sexp[1] instanceof Array) && isSymbolEqualTo(sexp[1][0], "lib")){
        // is it (require (lib)) or (require (lib <string>))
        if(sexp[1].length < 3){
          var partsNum = sexp[1].slice(1).length,
              partsStr = partsNum + ((partsNum===1)? " part" : " parts");
          throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected at least two strings after "
                                        , new types.ColoredPart("lib", sexp[1][0].location)
                                        , " but found only "
                                        , partsStr]),
                     sexp.location);
        }
        // is it (require (lib not-strings))?
        rest(sexp[1]).forEach(function(lit){
          if (!(isString(lit))){
            throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                        , ": expected a string for a library collection, but found "
                                        , new types.ColoredPart("something else", str.location)]),
                       sexp.location);
          }
         });
    // if it's (require (planet...))
    } else if((sexp[1] instanceof Array) && isSymbolEqualTo(sexp[1][0], "planet")){
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": Importing PLaneT pacakges is not supported at this time"]),
                 sexp.location);
    // if it's (require <not-a-string-or-symbol>)
    } else if(!((sexp[1] instanceof symbolExpr) || isString(sexp[1]))){
      throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": expected a module name as a string or a `(lib ...)' form, but found "
                                    , new types.ColoredPart("something else", sexp[1].location)]),
                 sexp.location);
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
        throwError(new types.Message([new types.ColoredPart(sexp[0].val, sexp[0].location)
                                    , ": I don't recognize the syntax of this "
                                    , new types.ColoredPart("clause", p.location)]),
                 sexp.location);
    });
    var provide = new provideStatement(clauses, sexp[0]);
    provide.location = sexp.location;
    return provide;
  }

  /////////////////////
  /* Export Bindings */
  /////////////////////
 plt.compiler.parse = parse;
})();