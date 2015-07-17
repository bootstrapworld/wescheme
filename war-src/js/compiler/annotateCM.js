goog.provide('plt.compiler.annotateCM');

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
goog.require("plt.compiler.structBinding");
goog.require("plt.compiler.constantBinding");
goog.require("plt.compiler.functionBinding");
goog.require("plt.compiler.moduleBinding");
goog.require("plt.compiler.knownModules");
goog.require("plt.compiler.throwError");

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
 var structBinding    = plt.compiler.structBinding;
 var constantBinding  = plt.compiler.constantBinding;
 var functionBinding  = plt.compiler.functionBinding;
 var moduleBinding    = plt.compiler.moduleBinding;
 var knownModules     = plt.compiler.knownModules;
 
 
 //////////////////////////////////////////////////////////////////////////////
 // ANNOTATE CM //////////////////////////////////////////////////////////////
 
 // addTarget : CM Location Location -> Void
 // add a target location to a CM textMarker, which marks the source location
 function addTarget(cm, srcLoc, destLoc, dir){
    var marks = cm.findMarksAt(cm.posFromIndex(srcLoc.startChar),
                               cm.posFromIndex(srcLoc.endChar)),
        marker = marks.filter(function(m){return m._targets;})[0];
    // If no marker exists, create one.
    if(!marker){
      marker = cm.markText(cm.posFromIndex(srcLoc.startChar),
                           cm.posFromIndex(srcLoc.endChar),
                           {_targets: []});
    }
    // add the target to an existing marker
    marker._targets.push({start: destLoc.startChar,
                         end: destLoc.endChar,
                         dir: dir});
 }
 

 // extend the Program class to annotated a CM instance with stored information
 // Program.annotateCM: cm -> voic
 Program.prototype.annotateCM = function(cm){ return; };
 defVar.prototype.annotateCM = function(cm){ this.expr.annotateCM(cm);  };
 defVars.prototype.annotateCM = function(cm){ this.expr.annotateCM(cm); };
 defFunc.prototype.annotateCM = function(cm){ this.body.annotateCM(cm); };
 beginExpr.prototype.annotateCM = function(cm){
    this.exprs.forEach(function(expr){ expr.annotateCM(cm);});
 };
 lambdaExpr.prototype.annotateCM = function(cm){ this.body.annotateCM(cm); };
 localExpr.prototype.annotateCM = function(cm){
    this.defs.forEach(function(d){ return d.annotateCM(cm);});
    this.body.annotateCM(cm);
 };
 callExpr.prototype.annotateCM = function(cm){
    [this.func].concat(this.args).forEach(function(arg){
                              if (arg instanceof Array){
                                arg.forEach(function(p){ p.annotateCM(cm); });
                              } else { arg.annotateCM(cm); }
                          });
 }
 ifExpr.prototype.annotateCM = function(cm){
    var exps = [this.predicate, this.consequence, this.alternative];
    return exps.forEach(function(exp){ exp.annotateCM(cm);});
 };
 // if the symbol has a binding location, save the loc start/end in the 'title' attribute
 symbolExpr.prototype.annotateCM = function(cm){
    if(this.bindingLoc){
      var useLoc = this.location, defLoc = this.bindingLoc;
      addTarget(cm, useLoc, defLoc, "use"); // point from the use to the def
      addTarget(cm, defLoc, useLoc, "def"); // point from the def to the use
    }
 };


/////////////////////////////////////////////////////////////
 // annotateCM : [listof Programs], cm -> void
 // clear all textmarkers that contain _targets, then add new ones
 // annotate the CM tokens based on information stored in the AST
 function annotateCM(programs, cm){
    cm.getAllMarks().filter(function(m){return m._targets;}).forEach(function(m){m.clear()});
    return programs.forEach(function(p){ return p.annotateCM(cm); });
 }
 
 /////////////////////
 /* Export Bindings */
 /////////////////////
 plt.compiler.annotateCM = function(program, cm, debug){
    var start       = new Date().getTime();
    try { annotateCM(program, cm); }             // do the actual work
    catch (e) { console.log("ANNOTATION ERROR"); throw e; }
    var end         = new Date().getTime();
    if(debug){
      console.log("Annotated in "+(Math.floor(end-start))+"ms");
    }
  };
 plt.compiler.annotateCM = annotateCM;
})();
