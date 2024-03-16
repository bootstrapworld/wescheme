goog.provide('plt.wescheme.WeSchemeTextContainer');
goog.require('plt.wescheme.topKeymap');
goog.require('plt.wescheme.BrowserDetect');

var WeSchemeTextContainer;

//TextContainers should support the following:
//onchange attribute: called whenever the text changes, with this bound to the container.

(function() {
	// container: DIV
	// WARNING WARNING. 
	// There's a non-obvious assumption of the textarea implementation:
	// The DIV is already attached to document.body.
	// If this assumptions are violated, then Bad Things happen.
	var gensym = 0;
	WeSchemeTextContainer = function(aDiv, options, afterInitialization, id) {
		var that = this;
		this.div = aDiv;
		this.mode = 'textarea';
		this.impl = null;
		this.options = options;
		this.keymaps = [];
		jQuery(this.div).empty();
		var tc = new CodeMirrorImplementation(this,
                                          options,
                                          function(anImpl){
                                            that.impl = anImpl;
                                            afterInitialization(that);
                                          });
	    tc.editor.getWrapperElement().id = id || 'textContainerID'+gensym;
	    tc.editor.getWrapperElement().impl = tc;
	    gensym++;
	};

	WeSchemeTextContainer.prototype.refresh = function() {
		this.impl.refresh();
	};
	// Returns a behavior of the source code
	WeSchemeTextContainer.prototype.getSourceB = function() {
		return this.impl.getSourceB();
	};
	WeSchemeTextContainer.prototype.getDiv = function() {
		return this.div;
	};
	// getCode: void -> string
	WeSchemeTextContainer.prototype.getCode = function() {
		return normalizeString(this.impl.getCode.apply(this.impl, arguments));
	};
	// setCode: string -> void
	WeSchemeTextContainer.prototype.setCode = function(code) {
		return this.impl.setCode(normalizeString(code));
	};
	// clearHistory: void -> void
	WeSchemeTextContainer.prototype.clearHistory = function() {
		return this.impl.clearHistory();
	};
	WeSchemeTextContainer.prototype.highlight = function(id, offset, line, column, span, color) {
		return this.impl.highlight(id, offset, line, column, span, color);
	};
	WeSchemeTextContainer.prototype.unhighlightAll = function () {
		return this.impl.unhighlightAll();
	};
	WeSchemeTextContainer.prototype.moveCursor = function(offset) {
		return this.impl.moveCursor(offset);
	};
	WeSchemeTextContainer.prototype.scrollIntoView = function(offset, margin) {
		this.impl.scrollIntoView(offset, margin);
	};
	WeSchemeTextContainer.prototype.setSelection = function(id, offset, line, column, span) {
		return this.impl.setSelection(id, offset, line, column, span);
	};
	WeSchemeTextContainer.prototype.focus = function() {
		this.impl.focus();
	};
	WeSchemeTextContainer.prototype.getCursorStartPosition = function() {
		return this.impl.getCursorStartPosition();
	};
	WeSchemeTextContainer.prototype.setCursorToBeginning = function() {
		this.impl.setCursorToBeginning();
	};

	WeSchemeTextContainer.prototype.setCursorToEnd = function() {
		this.impl.setCursorToEnd();
	};
  	WeSchemeTextContainer.prototype.getCSS = function(pos){
		return this.impl.getCSS(pos);
	}
	//////////////////////////////////////////////////////////////////////

	var CodeMirrorImplementation = function(parent, options, onSuccess) {

		// Note: "parent" seems to be a "WeSchemeTextContainer".
		//
		// Note: "CodeMirrorImplementation.editor" is set by the "initCallback"
		// of the "CodeMirror" created here, to the argument of the
		// "initCallback".

		var that = this;
		this.behaviorE = receiverE();
		this.behavior = startsWith(this.behaviorE, "");
		this.highlightedAreas = [];		
				
		
		var km = {};
		jQuery.extend(km,options.extraKeys);
		km["Tab"] = "indentAuto";
		km[plt.wescheme.BrowserDetect.OS==="Mac" ? "Cmd-I" : "Ctrl-I"] = function (ed) {
			var start = ed.getCursor(true);
			var end = ed.getCursor(false);
			CodeMirror.commands.selectAll(ed);
			CodeMirror.commands.indentAuto(ed);
			ed.setSelection(start,end);
		}

		this.editor = CodeMirror(
				parent.getDiv(), 
				{ 
					theme: (options.theme || "scheme"),
					mode: "scheme2",
					extraKeys: km,
					lineNumbers: (typeof (options.lineNumbers) !== undefined? options.lineNumbers :  true),
					lineWrapping: true,
					matchBrackets: options.matchBrackets || true,
					autoCloseBrackets: options.autoCloseBrackets || false,
					value: options.content || "",
					readOnly: (typeof (options.readOnly) !== undefined? options.readOnly : false),
          			cursorBlinkRate: (typeof (options.cursorBlinkRate) !== undefined? options.cursorBlinkRate : 350)
      			 	//inputStyle: "contenteditable"  /*  Force on for screen readers  */
				});
       	this.editor.getGutterElement().setAttribute('aria-hidden', "true"); // ARIA - don't read line numbers
       	this.editor.on('change', function() { that.behaviorE.sendEvent(that.editor.getValue());});
       	this.editor.getInputField().setAttribute("role", "input");
        // capture all paste events, and remove curly quotes before inserting
        // this solves the use-case where a teacher uses a rich text editor to write code
        // (using bold/italic to emphasize parts), and then pastes it into WeScheme
        this.editor.on("beforeChange",
          function(cm, changeObj){
           function replaceQuotes(str){
              return str.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
           }
           // bail if it's not a paste event
           if(changeObj.origin==="paste") changeObj.text = changeObj.text.map(replaceQuotes);
           }
        );

        // Under IE 7, some of these style settings appear to die.
        try { this.editor.getWrapperElement().style.width = options.width || "100%"; } catch (e) {}
        if (! (options.dynamicHeight)) {
            // If dynamic height, we'll be doing something special below.
            try { this.editor.getWrapperElement().style.height = options.height || "100%"; } catch(e) {}
        }

        try {
          this.editor.getScrollerElement().style.width = "100%";
        } catch (e) {}

        // Setting overflow to visible to auto-resize the editor to fit
        // its content.  It may be that IE doesn't support setting some
        // of these attributes, so we are really crazy about putting
        // exception handling around this.
        if (options.dynamicHeight) {
            try { this.editor.getScrollerElement().style.height = 'auto'; } catch(e) {}
            try { this.editor.getScrollerElement().style.overflow = 'visible'; } catch(e) {}
        } else {
          try { this.editor.getScrollerElement().style.height = "100%"; } catch(e) {}
        }
	
	    this.editor.refresh();
      // if the 'clone' option is set, we create a linked doc that is updated as the definitions window changes
      // this doc is added to the 'middle' element, which likely ****BREAKS ABSTRACTION****
      // CSS is then used to hide everything except the clone
      if(options.clone && parent.div.id==="definitions"){
        var dummy = document.createElement('div');
        document.getElementById('middle').appendChild(dummy);
        var clone    = new CodeMirror(dummy,
                                    {value: this.editor.getDoc().linkedDoc(),
                                     lineNumbers: this.editor.getOption("lineNumbers"),
                                     viewportMargin: Infinity}),
            cloneDOM = clone.getWrapperElement();
        cloneDOM.id  = "printedCM";
      }
	  onSuccess.call(that, that);
	};

	CodeMirrorImplementation.prototype.getSourceB = function() {
		return this.behavior;
	};

	CodeMirrorImplementation.prototype.getCode = function(startOffset, endOffset) {
		// On exceptional cases, onChange does NOT get called.
		// I haven't traced exactly where this is happening in the
		// CodeMirror source, but it's happening.  So we have to do
		// some defensive programming here...
		var code = this.editor.getValue();
		if (valueNow(this.behavior) !== code) {
			this.behaviorE.sendEvent(code);
		}

		if (typeof(startOffset) !== undefined) {
			if (typeof(endOffset) !== undefined) {
				return code.substring(startOffset, endOffset);
			} else {
				return code.substring(startOffset);
			}
		} else {
			return code;
		}
	};

	CodeMirrorImplementation.prototype.setCode = function(code) {
		this.editor.setValue(code);
		this.behaviorE.sendEvent(code);
		this.editor.refresh();
	};

	CodeMirrorImplementation.prototype.clearHistory = function() {
		this.editor.clearHistory();
		this.editor.refresh();
	};
 
	//name for the current highlight's css
  	var currentHighlightNumber = 0;
	CodeMirrorImplementation.prototype.highlight = function(id, offset, line, column, span, color) {
		offset--; //off-by-one otherwise

		// make sure we're getting the right stylesheet!
		var stylesheet = document.querySelectorAll('[href="/css/default.css"]')[0].sheet,
        name = "highlight" + (currentHighlightNumber+'x');//to prevent overwriting with prefixes
		currentHighlightNumber++;
            
	    if (stylesheet.insertRule) {
	      stylesheet.insertRule("." + name + " { background-color: " + color + ";}", 0);
	    } else { // IE8 compatibility
	      stylesheet.addRule("." + name, "background-color: " + color + "", 0);
	    }

		var start = this.editor.posFromIndex(parseInt(offset)),
        	end   = this.editor.posFromIndex(parseInt(offset)+parseInt(span)),
        	highlightedArea = this.editor.markText(start, end, {className: name});
 		this.highlightedAreas.push(highlightedArea);
 		this.scrollIntoView(offset, span);
 		//return highlightedArea;
 		return {clear: function() { return highlightedArea.clear(); },
            	find: function() { return highlightedArea.find();  },
            	styleName: name}
	};
	
	CodeMirrorImplementation.prototype.moveCursor = function(offset) {
		var moveTo = this.editor.posFromIndex(offset);
		var li = moveTo.handle;
		var col = moveTo.column - 1; //off-by-one otherwise
		var currLine = this.editor.getCursor(false).line;
		
 		if(li != currLine) this.editor.setCursor({line: li, ch: col});
 		//if the line doesn't change, refocus doesn't happen, 
 		//so if they're the same change it twice
 		else {
 			this.editor.setCursor({line: li + 1, ch: col});
 			this.editor.setCursor({line: li, ch: col});
 		}
	};

	CodeMirrorImplementation.prototype.scrollIntoView = function(offset, margin) {
		var moveTo = this.editor.posFromIndex(offset);
    	moveTo.ch--; //off-by-one otherwise
    	this.editor.scrollIntoView(moveTo, margin);
	};

	CodeMirrorImplementation.prototype.setSelection = function(id, offset, line, column, span) {
    offset--; //off-by-one otherwise
		var start = this.editor.posFromIndex(parseInt(offset));
		var end = this.editor.posFromIndex(parseInt(offset)+parseInt(span));
		this.editor.setSelection(start, end);
	};
  	// clear all textMarkers, and reset the highlightedAreas array
	CodeMirrorImplementation.prototype.unhighlightAll = function () {
    this.highlightedAreas.forEach(function(ha){ ha.clear(); });
		this.highlightedAreas = [];
	};

	CodeMirrorImplementation.prototype.getCursorStartPosition = function() {
		return this.editor.indexFromPos(this.editor.getCursor(true));
	};

	CodeMirrorImplementation.prototype.setCursorToBeginning = function() {
		this.editor.setCursor(0,0)
	};

	CodeMirrorImplementation.prototype.setCursorToEnd = function() {
		this.editor.setCursor({line:this.editor.lineCount()});
	};

	CodeMirrorImplementation.prototype.shutdown = function() {
	};

	CodeMirrorImplementation.prototype.focus = function() {
    	this.editor.focus();
    	this.editor.refresh();
	};
	
	CodeMirrorImplementation.prototype.refresh = function() {
		this.editor.refresh();
	};
 
 	//takes in location info, returns css
	CodeMirrorImplementation.prototype.getCSS = function(pos) {
		return this.editor.findMarksAt(pos);
	};
	//////////////////////////////////////////////////////////////////////
	// Helpers
	var normalizeString = function(s) {
		return s.replace(/\r\n/g, "\n");
	};

})();

plt.wescheme.WeSchemeTextContainer = WeSchemeTextContainer;
