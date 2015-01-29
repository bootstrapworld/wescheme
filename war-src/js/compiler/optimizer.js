goog.provide('plt.compiler.optimize');

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
 
 var modified = false;
 
 //////////////////////////////////////////////////////////////////////////////
 // CONSTANT-FOLDING //////////////////////////////////////////////////////////

 Program.prototype.foldConstants = function(){ return this; };
 defFunc.prototype.foldConstants = function(){
    this.body = this.body.foldConstants();
    return this;
 };
 defVar.prototype.foldConstants = function(){
    this.expr = this.expr.foldConstants();
    return this;
 };
 defVars.prototype.foldConstants = function(){
    this.expr = this.expr.foldConstants();
    return this;
 };
 beginExpr.prototype.foldConstants = function(){
    this.exprs = foldConstants(this.exprs);
    return this;
 };
 lambdaExpr.prototype.foldConstants = function(){
    this.body = this.body.foldConstants();
    return this;
 };
 localExpr.prototype.foldConstants = function(){
    this.defs = foldConstants(this.defs);
    this.body = this.body.foldConstants();
    return this;
 };
 callExpr.prototype.foldConstants = function(){
    var that = this, foldableOps = ["+","-","*","/"], result;
    function isNumberLiteral(exp){
      return (exp instanceof literal) && jsnums.isSchemeNumber(exp.val);
    }
    function isNotOne(l){return !(l instanceof literal) || (l.val!==1); }
    function getVal(literal){return literal.val; }

    if((that.func instanceof symbolExpr) && (foldableOps.indexOf(that.func.val) > -1)){
      switch(that.func.val){
        case "+":
          // fold
          if(that.args.every(isNumberLiteral)){
            modified = true;
            result = new literal(that.args.map(getVal).reduce(jsnums.add, 0));
          }
          // (+ x) => x
          else if(that.args.length===1){
            result = that.args[0].foldConstants();
            modified = true;
          }
          // give up
          else{
            that.args = foldConstants(that.args);
            result = that;
          }
          break;
        case "-":
          // fold
          if((that.args.length >= 2) && that.args.every(isNumberLiteral)){
            result = new literal(that.args.slice(1).map(getVal).reduce(jsnums.subtract, that.args[0].val));
            modified = true;
          }
          // (- 3) => -3
          else if((that.args.length===1) && isNumberLiteral(that.args[0])){
            result = new literal(jsnums.multiply(-1, args[0].val));
            modified = true;
          }
          // give up
          else{
            that.args = foldConstants(that.args);
            result = that;
          }
          break;
        case "*":
          // fold
          if(that.args.every(isNumberLiteral)){
            result = new literal(that.args.map(getVal).reduce(jsnums.multiply, 1));
            modified = true;
          }
          // (* ... 0 ...) => 0
          else if(that.args.some(function(l){return isNumberLiteral(l) && (l.val===0);})){
            result = new literal(0);
            modified = true;
          }
          // (* 3) => 3
          else if(that.args.length===1){
            result = that.args[0].foldConstants();
            modified = true;
          }
          else{
            that.args = foldConstants(that.args);
            result = that;
          }
          break;
        case "/":
          // remove any argument after the first one that is a 1
          if(that.args.length >= 2){
            that.args = foldConstants([that.args[0]].concat(that.args.slice(1).filter(isNotOne)));
            modified = true;
          }
          // fold
          if((that.args.length >= 2) && that.args.every(isNumberLiteral)){
            result = new literal(that.args.slice(1).map(getVal).reduce(jsnums.divide, that.args[0].val));
            modified = true;
          }
          // (/ 3) => 1/3
          else if((that.args.length===1) && isNumberLiteral(that.args[0])){
            result = new literal(jsnums.divide(1, that.args[0].val));
            modified = true;
          }
          // give up
          else{
            that.args = foldConstants(that.args);
            result = that;
          }
          break;
      }
      result.location = that.location;
      return result;
    } else {
      that.args = foldConstants(that.args);
      return that;
    }
 };
 // eliminate branches if we know the predicate already
 ifExpr.prototype.foldConstants = function(){
    if(isBooleanSym(this.predicate)){
      modified = true;
      return (this.predicate.val==="true")? this.consequence : this.alternative;
    }
    this.predicate = this.predicate.foldConstants();
    this.consequence = this.consequence.foldConstants();
    this.alternative = this.alternative.foldConstants();
    return this;
 };
 // ands become nested ifs
 andExpr.prototype.foldConstants = function(){
    this.exprs = foldConstants(this.exprs);
    return this;
 };
 // ors become nested lets-with-if-bodies
 orExpr.prototype.foldConstants = function(){
    this.exprs = foldConstants(this.exprs);
    return this;
 };
 
 //////////////////////////////////////////////////////////////////////////////
 // REMOVE RUNTIME CHECKS /////////////////////////////////////////////////////
 
 function isBooleanSym(x){
  return (x instanceof symbolExpr) && ((x.val==="true") || (x.val==="false"));
 }

 // Program.prototype.desugar: pinfo -> [Program, pinfo]
 Program.prototype.removeRuntimeChecks = function(){ return this; };
 defFunc.prototype.removeRuntimeChecks = function(){
    this.body = this.body.removeRuntimeChecks();
    return this;
 };
 defVar.prototype.removeRuntimeChecks = function(){
    this.expr = this.expr.removeRuntimeChecks();
    return this;
 };
 defVars.prototype.removeRuntimeChecks = function(){
    this.exprs = this.expr.removeRuntimeChecks();
    return this;
 };
 beginExpr.prototype.removeRuntimeChecks = function(){
    this.exprs = removeRuntimeChecks(this.expr);
    return this;
 };
 lambdaExpr.prototype.removeRuntimeChecks = function(){
    this.body = this.body.foldConstants();
    return this;
 };
 localExpr.prototype.removeRuntimeChecks = function(){
    this.defs = removeRuntimeChecks(this.defs);
    this.body = this.body.removeRuntimeChecks();
    return this;
 };
 // unwrap verify-boolean-branch-value if we're already
 // using a boolean value
 callExpr.prototype.removeRuntimeChecks = function(){
    if((this.func instanceof symbolExpr)
       && (this.func.val==="verify-boolean-branch-value")
       && isBooleanSym(this.args[2])){
      modified = true;
      return this.args[2];
    }
    this.args = removeRuntimeChecks(this.args);
    return this;
 };
 ifExpr.prototype.removeRuntimeChecks = function(){
    this.predicate = this.predicate.removeRuntimeChecks();
    this.consequence = this.consequence.removeRuntimeChecks();
    this.alternative = this.alternative.removeRuntimeChecks();
    return this;
 };
 andExpr.prototype.removeRuntimeChecks = function(){
    this.exprs = foldConstants(this.exprs);
    return this;
 };
 orExpr.prototype.removeRuntimeChecks = function(){
    this.exprs = foldConstants(this.exprs);
    return this;
 };
 
 //////////////////////////////////////////////////////////////////////////////
 // INLINE //////////////////////////////////////////////////////////

 // Program.prototype.inline: pinfo -> [Program, pinfo]
 Program.prototype.inline = function(){ return this; };
 /*
 defFunc.prototype.inline = function(){
 };
 defVar.prototype.inline = function(){
 };
 defVars.prototype.inline = function{
 };
 defStruct.prototype.inline = function(){
 };
 beginExpr.prototype.inline = function(){
 };
 lambdaExpr.prototype.inline = function(){
 };
 localExpr.prototype.inline = function(){
 };
 callExpr.prototype.inline = function(){
 };
 ifExpr.prototype.inline = function(){
 };
 // ands become nested ifs
 andExpr.prototype.inline = function(){
 };
 // ors become nested lets-with-if-bodies
 orExpr.prototype.inline = function(){
 };
 quotedExpr.prototype.inline = function () {
 };
 symbolExpr.prototype.inline = function(){
 };
*/
 /////////////////////////////////////////////////////////////
 
 // optimize : [listof Programs] -> [listof Programs]
 // run through all three phases
 function optimize(programs){
    function optimize_(programs, passes){
      modified = false;
      programs = foldConstants(programs);
      programs = removeRuntimeChecks(programs);
      return (modified && (passes<5))? optimize_(programs, passes+1) : programs;
    }
    return optimize_(programs, 0);
 }
 // inline: [listof Programs] pinfo -> [listof Programs]
 // Collects the definitions either imported or defined by this program.
 function inline(programs, pinfo){
   return programs.reduce((function(pinfo, p){ return p.inline(pinfo); })
                          , pinfo);
 }
 // foldConstants: [listof Programs] -> [listof Programs]
 // Walk through the program and collect all the provide statements.
 function foldConstants(programs){
 return programs.map(function(p){ return p.foldConstants(); });
 }
 // removeRuntimeChecks: [listof Programs] -> foldConstants
 // Collects the uses of bindings that this program uses.
  function removeRuntimeChecks(programs){
    return programs.map(function(p){ return p.removeRuntimeChecks(); });
  }
 
 /////////////////////
 /* Export Bindings */
 /////////////////////
 plt.compiler.optimize = function(programs){
    var start       = new Date().getTime();
    try { var optimized = optimize(programs); }             // do the actual work
    catch (e) { console.log("OPTIMIZATION ERROR"); throw e; }
    var end         = new Date().getTime();
    if(debug){
      console.log("Optimized in "+(Math.floor(end-start))+"ms");
    }
    return optimized;
 }
})();
