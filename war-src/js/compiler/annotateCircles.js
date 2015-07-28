goog.provide('plt.compiler.convertToCircles');

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
 
 function clickHandler(evt){
 console.log(evt);
    var expressionNode = evt.target.parentNode || evt.srcElement.parentNode;
    expressionNode.className = (expressionNode.className==="codesexp")? "circleevalsexp" : "codesexp";
 }
 
 
 
 //////////////////////////////////////////////////////////////////////////////
 // ANNOTATE CIRCLES ////////////////////////////////////////////////////////////////

 // programToCircles : Listof Programs CM -> Listof DOM nodes
 // assign widgets representing circles of evaluation to tokens in CM
 function programToCircles(programs, cm){
   var circles_ = document.querySelectorAll('.circleevalexp');
   function handleDragStart(e) {
     e.dataTransfer.effectAllowed = 'move';
     e.dataTransfer.setData('text/html', this.innerHTML);
     dragSrcEl_ = this;
   console.log('dragstart!');
     dragSrcEl_.style.opacity = '0.5';
     // this/e.target is the source node.
     this.addClassName('moving');
   };
   
   function handleDragOver(e) {
          if (e.preventDefault) {
              e.preventDefault(); // Allows us to drop.
          }
          e.dataTransfer.dropEffect = 'move';
          return false;
   };
   function handleDragEnter(e) {
          this.addClassName('over');
   };
   function handleDragLeave(e) {
          // this/e.target is previous target element.
          this.removeClassName('over');
   };
   function handleDrop(e) {
          // this/e.target is current target element.

          if (e.stopPropagation) {
              e.stopPropagation(); // stops the browser from redirecting.
          }
          // Don't do anything if we're dropping on the same box we're dragging.
          if (dragSrcEl_ != this) {
              dragSrcEl_.innerHTML = this.innerHTML;
              this.innerHTML = e.dataTransfer.getData('text/html');
          }
          return false;
    };
    function handleDragEnd(e) {
        // this/e.target is the source node.
        this.style.opacity = '1';

        [ ].forEach.call(circles_, function (box) {
            box.removeClassName('over');
            box.removeClassName('moving');
        });
    };
    var circles = programs.map(function(p){
      var dom = p.toCircles(cm);
      dom.location = p.location;
      return dom;
    });
 
    [ ].forEach.call(circles_, function (box) {
        box.setAttribute('draggable', 'true');  // Enable boxes to be draggable.
        box.addEventListener('dragstart', this.handleDragStart, false);
        box.addEventListener('dragenter', this.handleDragEnter, false);
        box.addEventListener('dragover', this.handleDragOver, false);
        box.addEventListener('dragleave', this.handleDragLeave, false);
        box.addEventListener('drop', this.handleDrop, false);
        box.addEventListener('dragend', this.handleDragEnd, false);
    });
    function markTextWithCircleWidget(circle){
      var from = cm.posFromIndex(circle.location.startChar),
          to   = cm.posFromIndex(circle.location.endChar);
      cm.markText(from, to, {replacedWith: circle, handleMouseEvents: true});
    }
 
    circles.forEach(markTextWithCircleWidget);
 }
 
 // Program.prototype.toCircles: CM -> DOM
 Program.prototype.toCircles = function(cm){
    throw this.constructor.name+" cannot be made into a Circle of Evaluation";
 };
 
 // we punt on definitions for now
 defFunc.prototype.toCircles = function(cm){
    return false;
 };
 defVar.prototype.toCircles = function(cm){
    return false;
 };
 defVars.prototype.toCircles = function(cm){
    return false;
 };
 defStruct.prototype.toCircles = function(cm){
    return false;
 };
 
 // make an expression, convert the operator to a circle, assign it the "operator" class,
 // and convert all the arguments to circles as well
 callExpr.prototype.toCircles = function(cm){
    var expression = document.createElement('div'),
        operator = this.func.toCircles(cm),
        lParen = document.createElement('span'),
        rParen = document.createElement('span'),
        startPos = cm.posFromIndex(this.location.startChar+1),
        endPos = cm.posFromIndex(this.location.endChar);
    expression.className = "circleevalsexp";
    operator.className = "operator";
    lParen.className = "lParen";
    rParen.className = "rParen";
    lParen.appendChild(document.createTextNode(cm.getTokenAt(startPos).string));
    rParen.appendChild(document.createTextNode(cm.getTokenAt(endPos).string));
    expression.appendChild(lParen);
    expression.appendChild(operator);
    this.args.forEach(function(arg){ expression.appendChild(arg.toCircles(cm)); });
    expression.appendChild(rParen);
 expression.draggable="true";
    return expression;
 };
 andExpr.prototype.toCircles = function(cm){
    var expression = document.createElement('div'),
        operator = document.createElement('span'),
        lParen = document.createElement('span'),
        rParen = document.createElement('span'),
        startPos = cm.posFromIndex(this.location.startChar+1),
        endPos = cm.posFromIndex(this.location.endChar);
    expression.className = "circleevalsexp";
    operator.className = "operator";
    lParen.className = "lParen";
    rParen.className = "rParen";
    lParen.appendChild(document.createTextNode(cm.getTokenAt(startPos).string));
    rParen.appendChild(document.createTextNode(cm.getTokenAt(endPos).string));
    expression.appendChild(lParen);
    operator.appendChild(document.createTextNode("and"));
    expression.appendChild(operator);
    this.exprs.forEach(function(arg){ expression.appendChild(arg.toCircles(cm)); });
    expression.appendChild(rParen);
    return expression;
 };
 orExpr.prototype.toCircles = function(cm){
    var expression = document.createElement('div'),
        operator = document.createElement('span'),
        lParen = document.createElement('span'),
        rParen = document.createElement('span'),
        startPos = cm.posFromIndex(this.location.startChar+1),
        endPos = cm.posFromIndex(this.location.endChar);
    expression.className = "circleevalsexp";
    operator.className = "operator";
    lParen.className = "lParen";
    rParen.className = "rParen";
    lParen.appendChild(document.createTextNode(cm.getTokenAt(startPos).string));
    rParen.appendChild(document.createTextNode(cm.getTokenAt(endPos).string));
    expression.appendChild(lParen);
    operator.appendChild(document.createTextNode("or"));
    expression.appendChild(operator);
    this.exprs.forEach(function(arg){ expression.appendChild(arg.toCircles(cm)); });
    expression.appendChild(rParen);
    return expression;
 };
 symbolExpr.prototype.toCircles = function(cm){
//    var tok = cm.getTokenAt(cm.posFromIndex(this.location.endChar));
    var value = document.createElement('span');
    value.className = "value";
    value.appendChild(document.createTextNode(this.val));
    if(this.val === "true" || this.val === "false") value.className+=" wescheme-boolean"
    return value;
 };
 literal.prototype.toCircles = function(cm){
    // if it's a Rational, BigInt, FloatPoint, Complex or Char, we can take care of it
    if(this.val.toCircles) return this.val.toCircles(cm);
    var value = document.createElement('span');
    // if it's Not A Number, assume it's a string. Otherwise, number.
    value.className = "value " + (isNaN(this.val)? "wescheme-string" : "wescheme-number");
    value.appendChild(document.createTextNode(this.toString()));
    return value;
 };
 jsnums.Rational.prototype.toCircles = function(cm){
    var value = document.createElement('span');
    value.className = "value wescheme-number";
    value.appendChild(document.createTextNode(this.toString(cm)));
    return value;
 };
 jsnums.BigInteger.prototype.toCircles = jsnums.Rational.prototype.toCircles;
 jsnums.FloatPoint.prototype.toCircles = jsnums.Rational.prototype.toCircles;
 jsnums.Complex.prototype.toCircles = jsnums.Rational.prototype.toCircles;
 Char.prototype.toCircles = function(cm){
    var value = document.createElement('span');
    value.className = "value wescheme-character";
    value.appendChild(document.createTextNode(this.toString()));
    return value;
 };
 
 /////////////////////
 /* Export Bindings */
 /////////////////////
 plt.compiler.convertToCircles = function(p, cm){
    var start       = new Date().getTime();
    try {
      return programToCircles(p, cm, true); // do the actual work
    } catch (e) { console.log("toCircles() ERROR"); throw e; }
    var end = new Date().getTime();
    if(debug){
      console.log("Converted toCircles in "+(Math.floor(end-start))+"ms");
    }
  };
})();
