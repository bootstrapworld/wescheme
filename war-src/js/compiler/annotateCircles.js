goog.provide('plt.compiler.convertToCircles');

goog.require("plt.compiler.literal");
goog.require("plt.compiler.symbolExpr");
goog.require("plt.compiler.Program");
goog.require("plt.compiler.couple");
goog.require("plt.compiler.andExpr");
goog.require("plt.compiler.orExpr");
goog.require("plt.compiler.condExpr");
goog.require("plt.compiler.lambdaExpr");
goog.require("plt.compiler.callExpr");

// if not defined, declare the compiler object as part of plt
window.plt   = window.plt   || {};
plt.compiler = plt.compiler || {};

// BubbleEditor : CM (Text->AST) -> BubbleEditor
// Given a CM instance and a parser, attach a bubble editor to the CM instance
function BubbleEditor(cm, parser){
  var that = this;
  // set up variables needed by the BubbleEditor
  that.cm = cm;
  that.parser = parser;
  that.wrapper = cm.getWrapperElement();
  that.circleIndices = {};
  that.buffer = document.getElementById('buffer') ||
                document.body.appendChild(document.createElement("textarea"));
  that.buffer.id = "buffer"; that.buffer.style.opacity = "0";
  that.buffer.style.position = "absolute";

  // clear everything
  that.clear = function(){
    that.cm.getAllMarks().filter(function(m){return m._circles;}).forEach(function(m){m.clear()});
  }

  // helper functions
  function isWhitespace(elt){return elt.classList.contains("cm-whitespace");}
  function isValue(elt){    return elt.classList.contains("value");}
  function isCircle(elt){   return elt.classList.contains("sexp");}
  function isSexp(elt){     return isValue(elt) || isCircle(elt); }
  function getNodeFromStoppedEvent(e){
    if(e){ e.stopPropagation(); return e.target || e.srcElement; }
  }
  
  that.nodeFromPos = function(pos){
    function isBefore(p1, p2){
      return (p1.line<p2.line) || ((p1.line===p2.line) && (p1.ch<=p2.ch));
    }
    function comesBetween(a, b, c){ return isBefore(a, b) && isBefore(b, c); }

    function findNodeInTree(t, p){
      for(var i = 0; i<t.children.length && isBefore(t.children[i].from, p); i++){
        var child = t.children[i];
        if(comesBetween(child.from, p, child.to)){ return findNodeInTree(child, p); }
      }
      return t;
    }
    
    for (var i in that.circleIndices) {
      if (that.circleIndices.hasOwnProperty(i)) {
        var n = that.circleIndices[i];
        if(comesBetween(n.from, pos, n.to)){ return findNodeInTree(n, pos); }
        else { continue; }
      }
    }
    return false;
  }
  
  that.nearestCommonAncestor = function(from, to){
    var fromPath=[];
    for(var pf=from; isSexp(pf); pf=pf.parentNode){ fromPath.push(pf); }
    for(var pt=to;   isSexp(pt); pt=pt.parentNode){
      if(fromPath.indexOf(pt) > -1) return pt; }
    return false;
  }

  that.processChange = function(cm, change){
    console.log('patching the bubble editor with:');
    change.from.ch++; // HACK!!! Need to align startCh with CM.getTokenAt().start
    var nca = that.nearestCommonAncestor(that.nodeFromPos(change.from),
                                         that.nodeFromPos(change.to));
    nca.to.ch = nca.to.ch + (change.text[0].length - change.removed[0].length);
    var text = cm.getRange(nca.from, nca.to);
    reparseNodeAndUpdateTree(nca, text);
  }

  // if a node is modified in-place, update the location of ancestors and siblings
  function reparseNodeAndUpdateTree(node, newText){
    // given a node and delta, move it and all its' children by that delta
    function shiftNode(node, delta){
      if(node.className === "lineBreak") return;
      delete that.circleIndices[cm.indexFromPos(node.from)];
      node.from.ch += delta; node.to.ch += delta;
      that.circleIndices[cm.indexFromPos(node.from)];
      for(var i = 0; i<node.children.length && node.children[i].from.line===line; i++){
        shiftNode(node.children[i], delta); };
    }
    // any following siblings on the same line should be *shifted* by delta
    function shiftSiblings(node, delta){
      for(var sib = node.nextSibling; sib && sib.from && (sib.from.line===line);
          sib = sib.nextSibling){ shiftNode(sib, delta); }
    }
    // If an Ancestor ends on the same line, it should be *extended* by delta,
    // with its' siblings shifted by the same amount
    function extendAncestors(node, delta){
      for(var parent = node.parentNode; isCircle(parent) && parent.to.line===line;
          parent = parent.parentNode){
        parent.to.ch += delta; shiftSiblings(parent, delta);
      }
    }
    console.log('replacing node at '+node.from.ch+'-'+node.to.ch+' with '+newText);
    // adjust the location information for the entire tree, based on the change
    var from  = node.from, to = node.to, line = to.line,
        delta = newText.length - (node.to.ch - node.from.ch);
    console.log('delta is: '+delta );
    node.to.ch = node.to.ch + delta; // adjust the node's location information
    shiftSiblings(node, delta);      // shift any siblings over
    extendAncestors(node, delta);    // extend any ancestors
    
    // remove the node being modified, and replace it with new nodes
    var AST   = that.parser(newText), parent = node.parentNode;
    console.log(AST);
    var circles = AST.map(function(p){return p.toCircles(cm);})
    circles.forEach(function(c){ c.classList.add('patched'); parent.insertBefore(c, node); });
    setTimeout(function(){assignEvents(parent);}, 500);
    node.parentNode.removeChild(node);
  }

  function sanitizeWhitespace(node, txt){
    var start = cm.indexFromPos(node.from),
        end   = cm.indexFromPos(node.to),
        prev  = cm.getRange(cm.posFromIndex(start-1), node.from),
        next  = cm.getRange(node.to, cm.posFromIndex(end+1));
    return  (/\s|[\(\[\{]/.test(prev)? "":" ")+ txt.trim() +(/\s|[\)\]\}]/.test(next)? "":" ");
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
    node.ondblclick = null; // allow dblclick to work normally
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
                  
  /////////  EVENT HANDLERS ///////////////////////////////
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
                  
  function saveEdit(node){
    node.onkeydown = null;
    node.contentEditable = "false";
    node.classList.remove('editing');
    cm.replaceRange(sanitizeWhitespace(node, node.innerText), node.from, node.to);
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
    e.codemirrorIgnore = true; e.preventDefault();
    var node = getNodeFromStoppedEvent(e) || node, active = document.activeElement;
    if(!node.location){
      var pos = cm.coordsChar({left: e.pageX, top: e.pageY});
      node.location = {startChar: pos.ch, endChar: pos.ch};
    }
    node.classList.remove('insert', 'replace');
    if (!active.contains(node)) {
      var text     = e.dataTransfer.getData('text');
      if(node.classList.contains('CodeMirror-line')){ // for dropping into the parent
        var pos = cm.coordsChar({left: e.pageX, top: e.pageY});
        node.from = node.to = pos;
      }
      text = sanitizeWhitespace(node, text);
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

   function assignEvents(parent){
      var tabIndex=1; // assign tab order
      Object.keys(that.circleIndices).forEach(function(k,i){
        that.circleIndices[k].tabIndex=tabIndex++;
      });
              
      // Assign Event Handlers (avoid addEventListener, which allows duplicates)
      var whitespace  = parent.querySelectorAll('.cm-whitespace'),
          sexpElts    = parent.querySelectorAll('.value, .sexp>*:nth-child(2), .sexp'),
          draggable   = parent.querySelectorAll('.value, .sexp>*:nth-child(2), .sexp'),
          dragTargets = parent.querySelectorAll('.value, .sexp>*:nth-child(2), .sexp, .cm-whitespace'),
          dropTargets = parent.querySelectorAll('.value, .sexp>*:nth-child(2), .cm-whitespace'),
          editable    = parent.querySelectorAll('.value');
              
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
      // allow dropping into the CM element
      that.cm.on("drop", function(cm, e){ e.CodeMirrorIgnore = true; handleDrop(e); });
      // Copy / Cut events must be captured and simulated
      document.oncut = document.oncopy = handleCopyCut;
      // Tab always selects the node after the cursor, or after the currently-selected node
      that.cm.on("keydown", function(cm, e){ if(e.which===9) e.codemirrorIgnore = true; });
      that.wrapper.onkeydown = handleKey;
    }


  // remove all bubbles and regenerate them, based on CM instance
  that.refresh = function(){
    console.log('refreshing entire bubble editor');
    that.clear();
    that.parser(that.cm.getValue()).forEach(function(p){
      var circle = p.toCircles(cm);
      that.cm.markText(circle.from, circle.to,
                       {replacedWith: circle
                       , handleMouseEvents: false
                       , _circles: true});
    });
    setTimeout(function(){assignEvents(that.wrapper)}, 400);
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
        var lineBreak = br.cloneNode(true);
        lineBreak.from = lineBreak.to = child.from;
        parent.appendChild(lineBreak);
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
                                        
    that.makeValue = function(valueTxt, className, location, cm){
      var node = document.createElement('span');
      node.className = "value "+className;
      node.appendChild(document.createTextNode(valueTxt));
      node.location = location;
      node.from = cm.posFromIndex(location.startChar);
      node.to   = cm.posFromIndex(location.endChar);
      node.draggable="true";
      node.setAttribute('aria-label', valueTxt);
      node.setAttribute('role', "treeitem");
      that.circleIndices[location.startChar] = node;
      return node;
    }
                                        
    that.makeExpression = function(func, args, location, cm){
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
      lParen.from = cm.posFromIndex(location.startChar);
      lParen.to = cm.posFromIndex(location.startChar+1);
      lParen.appendChild(document.createTextNode(cm.getTokenAt(startPos).string));
      rParen.appendChild(document.createTextNode(cm.getTokenAt(endPos).string));
      rParen.from = cm.posFromIndex(location.endChar);
      rParen.to = cm.posFromIndex(location.endChar+1);
      expression.appendChild(lParen);
      operator.location = func? func.location :
                  {startChar: location.startChar+1, endChar: location.endChar-1};
      operator.from = cm.posFromIndex(operator.location.startChar);
      operator.to = cm.posFromIndex(operator.location.endChar);
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
      that.circleIndices[location.startChar] = expression;
      return expression;
   }
                  
   // Program.prototype.toCircles: CM -> DOM
   plt.compiler.Program.prototype.toCircles = function(cm){
      throw this.constructor.name+" cannot be made into a Circle of Evaluation";
   };
    
   // make an expression, convert the operator to a circle, assign it the "operator" class,
   // and convert all the arguments to circles as well
   plt.compiler.callExpr.prototype.toCircles = function(cm){
      return that.makeExpression(this.func, this.args, this.location, cm);
   };
   plt.compiler.symbolExpr.prototype.toCircles = function(cm){
      return that.makeValue(this.val, "wescheme-symbol", this.location, cm);
   };
   plt.compiler.literal.prototype.toCircles = function(cm){
      // if it's a Rational, BigInt, FloatPoint, Complex or Char, we can take care of it
      if(this.val.toCircles) return this.val.toCircles(cm);
      // if it's Not A Number, assume it's a string. Otherwise, number.
      var className = isNaN(this.val)? "wescheme-string" : "wescheme-number";
      return that.makeValue(this.toString(), className, this.location, cm);
   };
   jsnums.Rational.prototype.toCircles = function(cm){
      return that.makeValue(this.toString(), "wescheme-number", this.location, cm);
   };
   jsnums.BigInteger.prototype.toCircles = jsnums.Rational.prototype.toCircles;
   jsnums.FloatPoint.prototype.toCircles = jsnums.Rational.prototype.toCircles;
   jsnums.Complex.prototype.toCircles = jsnums.Rational.prototype.toCircles;
   Char.prototype.toCircles = function(cm){
      return that.makeValue(this.toString(), "wescheme-character", this.location, cm);
   };
   
    that.refresh();
    return that;
}
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
