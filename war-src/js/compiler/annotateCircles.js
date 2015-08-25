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

 //////////////////////////////////////////////////////////////////////////////
 // ANNOTATE CIRCLES ////////////////////////////////////////////////////////////////
 
 // programToCircles : Listof Programs CM -> Listof DOM nodes
 // assign widgets representing circles of evaluation to tokens in CM
 function programToCircles(programs, cm){
    console.log('refreshing');
    cm.circleIndices = {};
    // clear circles
    cm.getAllMarks().filter(function(m){return m._circles;}).forEach(function(m){m.clear()});
    // set up offscreen textarea
    var buffer = document.getElementById('buffer') ||
                document.body.appendChild(document.createElement("textarea"));
    buffer.id = "buffer"; buffer.style.opacity = "0";
    buffer.style.position = "absolute";
 
    // helper functions
    function isWhitespace(elt){return elt.classList.contains("cm-whitespace");}
    function isValue(elt){    return elt.classList.contains("value");}
    function isCircle(elt){   return elt.classList.contains("sexp");}
    function isSexp(elt){     return isValue(elt) || isCircle(elt); }
    function getNodeFromStoppedEvent(e){
      if(e){ e.stopPropagation(); return e.target || e.srcElement; }
    }
 
    // Tab always selects the node after the cursor, or after the currently-selected node
    cm.on("keydown", function(cm, e){ if(e.which===9) e.codemirrorIgnore = true; });
 
    // Copy / Cut events must be captured and simulated
    document.oncut = document.oncopy = handleCopyCut;
    function handleCopyCut(e){
      var active = document.activeElement;
      if(isSexp(active)){
        e.stopPropagation();
        buffer.innerText = cm.getRange(active.from, active.to);
        buffer.select();
        try{ document.execCommand(e.type); }
        catch(e) { console.log('problem with execCommand("'+e.type+'")'); }
        setTimeout(function(){active.focus();}, 200);
      }
      if(e.type==="cut") cm.replaceRange('', active.from, active.to);
    };
 
    // avoid addEventListener, since it will register duplicate handlers
    cm.getWrapperElement().onkeydown = handleKey;
    function handleKey(e){
      var active = document.activeElement
      if(e.which===8 && isSexp(active)){    // DELETE
        e.preventDefault();
        cm.replaceRange('', active.from, active.to);
      }
      if (e.which===13 && isValue(active)){ // RETURN
        e.preventDefault();
        startEdit(false, active);
      }
      if(e.which===9){                      // TAB
        e.codemirrorIgnore = true; e.stopPropagation();
      }
      if(e.which===57){                     // OPEN PAREN
        e.preventDefault();
        cm.replaceRange('()', cm.getCursor(), cm.getCursor());
        var idx = cm.indexFromPos(cm.getCursor());
      }
      if(e.which===48 && isSexp(active)){   // CLOSE PAREN
        e.preventDefault();
        while(!active.classList.contains("CodeMirror-widget"))
          active = active.parentNode;
        var endIndex = cm.indexFromPos(active.firstChild.to);
        cm.setCursor(cm.posFromIndex(endIndex+1)); cm.focus();
      }
    };
 
    // 1) convert the AST to a list of DOM trees
    programs.forEach(function(p){
      var circle = p.toCircles(cm);
      cm.markText(circle.from, circle.to,
                 {replacedWith: circle
                 , handleMouseEvents: false
                 , _circles: true});    });
 
    function setCursor(startChar, offset){
      var node = cm.circleIndices[startChar];
      node.focus(); return node;
    }
 
    // select the highlighted node.
    function selectNode(e, node){
      node = getNodeFromStoppedEvent(e) || node;
      if(isWhitespace(node) || isSexp(node)){ node.focus(); }
      else { node.parentNode.focus(); }
    }
 
    // insert cursor at beginning of node.
    function startEdit(e, node){
      node = getNodeFromStoppedEvent(e) || node;
      node.contentEditable = "true";
      node.onblur = function(){saveEdit(node)};
      node.onkeydown = function(e){
        e.stopPropagation();
        e.codemirrorIgnore = true;
        if (e.which===13 || e.which===9){        // RETURN / TAB: blur() to save
          node.blur();
        } else if(e.which===32){                 // SPACE: ignore?
        }
      };
      var range = document.createRange();
      range.setStart(node, 0);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    // remove keyhandlers and update CM
    function saveEdit(node){
      node.onkeydown = null;
      node.contentEditable = "false";
      node.classList.remove('editing');
      var text = node.innerText;
      // add spaces if we're inserting new text
      if(isWhitespace(node)){ text = " "+node.innerText+" "; }
      cm.replaceRange(text, node.from, node.to);
    }
 
    function handleDragStart(e){// make draggable things translucent
      var node = getNodeFromStoppedEvent(e) || node;
      node.style.opacity = '0.2';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text', cm.getRange(node.from, node.to));
    }
    function handleDragOver(e){ // apparently HTML5 requires this?!?!?
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      return false;
    }
    function colorTarget(e) {   // add dragover styles
      var node = getNodeFromStoppedEvent(e) || node;
      if(!document.activeElement.contains(node)){
        node.classList.add(isWhitespace(node)? 'insert' : 'replace');
      }
    }
    function unColorTarget(e) { // remove dragover styles
      var node = getNodeFromStoppedEvent(e) || node;
      node.classList.remove('insert', 'replace');
    }
    function cleanUp(e) {       // make sure nothing is left partially-opaque
      var node = getNodeFromStoppedEvent(e) || node;
      node.style.opacity = '1.0';
    }
    // if we've dropped one element into a different one, perform the CM modifications
    function handleDrop(e) {
      e.codemirrorIgnore = true;
      var node = getNodeFromStoppedEvent(e) || node, active = document.activeElement;
      if(!node.location){
        var pos = cm.coordsChar({left: e.pageX, top: e.pageY});
        node.location = {startChar: pos.ch, endChar: pos.ch};
      }
      node.classList.remove('insert', 'replace');
      if (!active.contains(node)) {
        if(active === cm.getInputField()){ // for dropping into the parent
          var idx = cm.getValue().length+1;
          cm.replaceRange(text, node.from, node.to);
          active.location = {startChar: idx, endChar: idx};
          return;
        }
        var text     = e.dataTransfer.getData('text');
        // if we're inserting new text, decide if we need extra spaces
        if(isWhitespace(node)){
          var start = cm.indexFromPos(node.from),
              end   = cm.indexFromPos(node.to),
              prev  = cm.getRange(cm.posFromIndex(start-1), node.from),
              next  = cm.getRange(node.to, cm.posFromIndex(end+1));
          var spaceOrBracket = /\s|[\(\[\{\)\}\]]/;
          text =  (spaceOrBracket.test(prev)? "" : " ") +
                  e.dataTransfer.getData('text') +
                  (spaceOrBracket.test(next)? "" : " ");
        }
        // Modify the src or dest first, depending on which comes earlier in the document
        // Be sure to combine both operations into one, so undo works properly
        cm.operation(function(){
          if(cm.indexFromPos(active.to) < cm.indexFromPos(node.from)){
            cm.replaceRange(text, node.from, node.to);
            cm.replaceRange('', active.from, active.to);
          } else {
            cm.replaceRange('', active.from, active.to);
            cm.replaceRange(text, node.from, node.to);
          }
        });
      }
      return false;
    }
 
 setTimeout(function(){
    var tabIndex=1; // assign tab order
    Object.keys(cm.circleIndices).forEach(function(k,i){
      cm.circleIndices[k].tabIndex=tabIndex++;
    });
            
    // Assign Event Handlers (avoid addEventListener, which allows duplicates)
    var whitespace  = document.querySelectorAll('.cm-whitespace'),
        sexpElts    = document.querySelectorAll('.value, .sexp>*:nth-child(2), .sexp'),
        draggable   = document.querySelectorAll('.value, .sexp>*:nth-child(2), .sexp'),
        dragTargets = document.querySelectorAll('.value, .sexp>*:nth-child(2), .sexp, .cm-whitespace'),
        dropTargets = document.querySelectorAll('.value, .sexp>*:nth-child(2), .cm-whitespace'),
        editable    = document.querySelectorAll('.value'),
        parent = cm.getWrapperElement();
            
    // editable things can be edited on dblclick
    [ ].forEach.call(editable,  function (elt){elt.ondblclick = startEdit;});
    // whitespace becomes editable the moment you click
    [ ].forEach.call(whitespace,  function (elt){elt.onclick = startEdit;});
    // values and expressions can be clicked and dragged
    [ ].forEach.call(sexpElts,    function (elt){
       elt.onclick = selectNode; elt.ondragstart = handleDragStart; });
    // all elements can be dragged over
    [ ].forEach.call(dragTargets, function (elt){
       elt.ondragover = handleDragOver; elt.ondragend = cleanUp; });
    // anything but a circe can be dropped into/over
    [ ].forEach.call(dropTargets, function (elt){
       elt.ondragenter = colorTarget; elt.ondragleave = unColorTarget;
       elt.ondrop = handleDrop; });
            
    parent.addEventListener("dragenter", colorTarget,     false);
    parent.addEventListener("dragover",  handleDragOver,  false);
    parent.addEventListener("dragleave", unColorTarget,   false);
    parent.addEventListener("drop",      handleDrop,      false);
 
  }, 400);
 }
                                      
 function addChildAfterPos(parent, child, cm){
    var startCh = parent.lastChild? parent.lastChild.location.endChar : parent.location.startChar,
        startLn = parent.lastChild? parent.lastChild.location.endRow : parent.location.startRow,
        endCh   = child.location.startChar,
        endLn   = child.location.startRow,
        br      = document.createElement('span'),
        str     = cm.getRange(cm.posFromIndex(startCh), cm.posFromIndex(endCh),"\n"),
        lines   = str.split("\n"),
        spansMultipleLines = lines.length>1;
    br.style.height = "0"; br.className = "lineBreak";
    parent.appendChild(makeWhitespace(startCh, lines[0], cm));
    for(var i=1; i<lines.length; i++){
      parent.appendChild(br.cloneNode(true));
      parent.appendChild(makeWhitespace(startCh, lines[i], cm));
      startCh+=lines[i].length+1;
    }
    parent.appendChild(child);
    return spansMultipleLines;
 }
                                      
  function makeWhitespace(startCh, txt, cm){
    var space   = document.createElement('span');
    space.className="cm-whitespace";
    space.location = {startChar: startCh, endChar: startCh+txt.length};
    space.from = cm.posFromIndex(startCh);
    space.to = cm.posFromIndex(startCh+txt.length);
    space.appendChild(document.createTextNode(txt));
    return space;
  }
                                      
  function makeValue(valueTxt, className, location, cm){
    var node = document.createElement('span');
    node.className = "value "+className;
    node.appendChild(document.createTextNode(valueTxt));
    node.location = location;
    node.from = cm.posFromIndex(location.startChar);
    node.to   = cm.posFromIndex(location.endChar);
    node.draggable="true";
    node.setAttribute('aria-label', valueTxt);
    node.setAttribute('role', "treeitem");
    cm.circleIndices[location.startChar] = node;
    return node;
  }
                                      
  function makeExpression(func, args, location, cm){
    var expression = document.createElement('div'),
        ariaStr = (func? func.val : "empty") +
                  " expression, " + args.length+" argument" +
                  (args.length===1 ? "" : "s"),
        operator = document.createElement('span'),
        lParen = document.createElement('span'),
        rParen = document.createElement('span'),
        startPos = cm.posFromIndex(location.startChar+1),
        endPos = cm.posFromIndex(location.endChar);
    expression.classList.add("sexp");
    expression.location = location;
    expression.from = cm.posFromIndex(location.startChar);
    expression.to   = cm.posFromIndex(location.endChar);
    lParen.className = "lParen";        rParen.className = "rParen";
    lParen.location = location.start(); rParen.location = location.end();
    lParen.appendChild(document.createTextNode(cm.getTokenAt(startPos).string));
    rParen.appendChild(document.createTextNode(cm.getTokenAt(endPos).string));
    expression.appendChild(lParen);
    operator.location = func? func.location :
                {startChar: location.startChar+1, endChar: location.endChar-1};
    var funcValue = func? func.toCircles(cm) :
                    makeValue(" ", "cm-whitespace", operator.location, cm);
    funcValue.location = operator.location;
    operator.appendChild(funcValue);
    expression.appendChild(operator);
    args.forEach(function(arg){ addChildAfterPos(expression, arg.toCircles(cm), cm); });
    if(func){ addChildAfterPos(expression, rParen, cm); } 
    else {
      var filler = document.createElement("span");
      filler.style.cssText = "min-height: 15px; display: inline-block; vertical-align: middle;";
      expression.appendChild(filler);
      expression.appendChild(rParen);
    }
    expression.draggable="true";
    expression.setAttribute('aria-label', ariaStr);
    expression.setAttribute('role', "treeitem");
    cm.circleIndices[location.startChar] = expression;
    return expression;
  }
 // Program.prototype.toCircles: CM -> DOM
 Program.prototype.toCircles = function(cm){
    throw this.constructor.name+" cannot be made into a Circle of Evaluation";
 };
  
 // make an expression, convert the operator to a circle, assign it the "operator" class,
 // and convert all the arguments to circles as well
 callExpr.prototype.toCircles = function(cm){
    return makeExpression(this.func, this.args, this.location, cm);
 };
 symbolExpr.prototype.toCircles = function(cm){
    return makeValue(this.val, "wescheme-symbol", this.location, cm);
 };
 literal.prototype.toCircles = function(cm){
    // if it's a Rational, BigInt, FloatPoint, Complex or Char, we can take care of it
    if(this.val.toCircles) return this.val.toCircles(cm);
    // if it's Not A Number, assume it's a string. Otherwise, number.
    var className = isNaN(this.val)? "wescheme-string" : "wescheme-number";
    return makeValue(this.toString(), className, this.location, cm);
 };
 jsnums.Rational.prototype.toCircles = function(cm){
    return makeValue(this.toString(), "wescheme-number", this.location, cm);
 };
 jsnums.BigInteger.prototype.toCircles = jsnums.Rational.prototype.toCircles;
 jsnums.FloatPoint.prototype.toCircles = jsnums.Rational.prototype.toCircles;
 jsnums.Complex.prototype.toCircles = jsnums.Rational.prototype.toCircles;
 Char.prototype.toCircles = function(cm){
    return makeValue(this.toString(), "wescheme-character", this.location, cm);
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