goog.provide('plt.compiler.foldConstants');
goog.provide('plt.compiler.removeRuntimeChecks');
goog.provide('plt.compiler.inline');

goog.require("plt.compiler.literal");
goog.require("plt.compiler.symbolExpr");
goog.require("plt.compiler.Program");
goog.require("plt.compiler.couple");
goog.require("plt.compiler.ifExpr");
goog.require("plt.compiler.beginExpr");
goog.require("plt.compiler.localExpr");
goog.require("plt.compiler.andExpr");
goog.require("plt.compiler.orExpr");
goog.require("plt.compiler.lambdaExpr");
goog.require("plt.compiler.quotedExpr");
goog.require("plt.compiler.callExpr");
goog.require("plt.compiler.defFunc");
goog.require("plt.compiler.defVar");
goog.require("plt.compiler.defVars");
goog.require("plt.compiler.defStruct");
goog.require("plt.compiler.requireExpr");
goog.require("plt.compiler.provideStatement");

// if not defined, declare the compiler object as part of plt
window.plt   = window.plt   || {};
plt.compiler = plt.compiler || {};

/*
 TODO
 - stop using synchronous XmlHttpRequests -> probably only after the compiler is folded into the evaluator
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
 var localExpr        = plt.compiler.localExpr;
 var andExpr          = plt.compiler.andExpr;
 var orExpr           = plt.compiler.orExpr;
 var lambdaExpr       = plt.compiler.lambdaExpr;
 var quotedExpr       = plt.compiler.quotedExpr;
 var callExpr         = plt.compiler.callExpr;
 var defFunc          = plt.compiler.defFunc;
 var defVar           = plt.compiler.defVar;
 var defVars          = plt.compiler.defVars;
 var defStruct        = plt.compiler.defStruct;
 var requireExpr      = plt.compiler.requireExpr;
 var provideStatement = plt.compiler.provideStatement;
 
 var throwError       = plt.compiler.throwError;
 
 
 //////////////////////////////////////////////////////////////////////////////
 // CONSTANT-FOLDING //////////////////////////////////////////////////////////

 // produce a function to mapped over a list of numbers, and a base case if the
 // list has fewer than 2 elements
 var getFoldFunctionAndBase = {
  "+":    [jsnums.add, 0]; },
  "-":    [jsnums.subtract, 0]; },
  "*":    [jsnums.multiply, 1]; },
  "/":    [jsnums.divide, 1]; }
 }
 
 Program.prototype.foldConstants = function(pinfo){ return [this, pinfo]; };
 defFunc.prototype.foldConstants = function(pinfo){
    this.body = this.body.foldConstants(pinfo);
    return this;
 };
 defVar.prototype.foldConstants = function(pinfo){
    this.expr = foldConstants(this.expr, pinfo);
    return this;
 };
 defVars.prototype.foldConstants = function(pinfo){
    this.expr = foldConstants(this.expr, pinfo);
    return this;
 };
 beginExpr.prototype.foldConstants = function(pinfo){
    this.exprs = foldConstants(this.exprs, pinfo);
    return this;
 };
 lambdaExpr.prototype.foldConstants = function(pinfo){
    this.body = this.body.foldConstants(pinfo);
    return this;
 };
 localExpr.prototype.foldConstants = function(pinfo){
    this.body = this.body.foldConstants(pinfo);
    return this;
 };
 callExpr.prototype.foldConstants = function(pinfo){
    var that = this;
    function isNumberLiteral(exp){
      return (exp instanceof literal) && jsnums.isSchemeNumber(exp.val);
    }
    // a callExpr is foldable if it's a recognized operator and all it's args are literals
    function isFoldable(){
      return (that.func instanceof symbolExpr)
            && getFoldFunctionAndBase(this.func)
            && that.args.every(isNumberLiteral);
    }
 
    if(isFoldable()){
      var fnAndBase = getFoldFunctionAndBase(this.func.val),
          fn = fnAndBase[0],
          base = fnAndBase[1],
          args = that.args.map(function(l){return l.val;}),
          first = (args.length==1)? base : args.slice(0,1),
          rest = (args.length==1)? args : args.slice(1),
          result = new literal(rest.reduce(fn, first));
      result.location = that.location;
      return result;
    } else {
      return that;
    }
 };
 ifExpr.prototype.foldConstants = function(pinfo){
    this.predicate = foldConstants(this.predicate, pinfo);
    this.consequence = foldConstants(this.consequence, pinfo);
    this.alternative = foldConstants(this.alternative, pinfo);
    return this;
 };
 // ands become nested ifs
 andExpr.prototype.foldConstants = function(pinfo){
    this.exprs = foldConstants(this.exprs, pinfo);
    return this;
 };
 // ors become nested lets-with-if-bodies
 orExpr.prototype.foldConstants = function(pinfo){
    this.exprs = foldConstants(this.exprs, pinfo);
    return this;
 };
 
 //////////////////////////////////////////////////////////////////////////////
 // REMOVE RUNTIME CHECKS /////////////////////////////////////////////////////

 // Program.prototype.desugar: pinfo -> [Program, pinfo]
 Program.prototype.foldConstants = function(pinfo){ return [this, pinfo]; };
 defFunc.prototype.foldConstants = function(pinfo){
 };
 defVar.prototype.foldConstants = function(pinfo){
 };
 defVars.prototype.foldConstants = function(pinfo){
 };
 defStruct.prototype.foldConstants = function(pinfo){
 };
 beginExpr.prototype.foldConstants = function(pinfo){
 };
 lambdaExpr.prototype.foldConstants = function(pinfo){
 };
 localExpr.prototype.foldConstants = function(pinfo){
 };
 callExpr.prototype.foldConstants = function(pinfo){
 };
 ifExpr.prototype.foldConstants = function(pinfo){
 };
 // ands become nested ifs
 andExpr.prototype.foldConstants = function(pinfo){
 };
 // ors become nested lets-with-if-bodies
 orExpr.prototype.foldConstants = function(pinfo){
 };
 quotedExpr.prototype.foldConstants = function (pinfo) {
 };
 symbolExpr.prototype.foldConstants = function(pinfo){
 };
 
 //////////////////////////////////////////////////////////////////////////////
 // INLINE //////////////////////////////////////////////////////////

 // Program.prototype.desugar: pinfo -> [Program, pinfo]
 Program.prototype.foldConstants = function(pinfo){ return [this, pinfo]; };
 defFunc.prototype.foldConstants = function(pinfo){
 };
 defVar.prototype.foldConstants = function(pinfo){
 };
 defVars.prototype.foldConstants = function(pinfo){
 };
 defStruct.prototype.foldConstants = function(pinfo){
 };
 beginExpr.prototype.foldConstants = function(pinfo){
 };
 lambdaExpr.prototype.foldConstants = function(pinfo){
 };
 localExpr.prototype.foldConstants = function(pinfo){
 };
 callExpr.prototype.foldConstants = function(pinfo){
 };
 ifExpr.prototype.foldConstants = function(pinfo){
 };
 // ands become nested ifs
 andExpr.prototype.foldConstants = function(pinfo){
 };
 // ors become nested lets-with-if-bodies
 orExpr.prototype.foldConstants = function(pinfo){
 };
 quotedExpr.prototype.foldConstants = function (pinfo) {
 };
 symbolExpr.prototype.foldConstants = function(pinfo){
 };

 /////////////////////////////////////////////////////////////
 // inline: [listof Programs] pinfo -> [listof Programs]
 // Collects the definitions either imported or defined by this program.
 function inline(programs, pinfo){
   return programs.reduce((function(pinfo, p){ return p.inline(pinfo); })
                          , pinfo);
 }
 // foldConstants: [listof Programs] pinfo -> [listof Programs]
 // Walk through the program and collect all the provide statements.
 function foldConstants(programs, pinfo){
    return programs.reduce((function(pinfo, p){ return p.foldConstants(pinfo); })
                           , pinfo);
 }
 // removeRuntimeChecks: [listof Programs] pinfo -> foldConstants
 // Collects the uses of bindings that this program uses.
  function removeRuntimeChecks(programs, pinfo){
    return programs.reduce((function(pinfo, p){ return p.removeRuntimeChecks(pinfo); })
                           , pinfo);
  }
 
 /////////////////////
 /* Export Bindings */
 /////////////////////
 plt.compiler.inline = inline;
 plt.compiler.foldConstants = foldConstants;
 plt.compiler.removeRuntimeChecks = removeRuntimeChecks;
})();
