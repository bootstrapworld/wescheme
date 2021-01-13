/*global goog,jQuery,plt*/
/*jslint browser: true, vars: true, white: true, plusplus: true, maxerr: 50, indent: 4 */
//if (typeof (plt) === 'undefined') {
//this.plt = {};
//}
//if (typeof (plt.wescheme) === 'undefined') {
//this.plt.wescheme = {};
//}

goog.provide("plt.wescheme.WeSchemeInteractions");

goog.require("plt.wescheme.topKeymap");
goog.require("plt.wescheme.WeSchemeTextContainer");
goog.require("plt.wescheme.tokenizer");
goog.require("plt.wescheme.WeSchemeProperties");
goog.require("plt.wescheme.RoundRobin");
goog.require("plt.wescheme.makeDynamicModuleLoader");

var WeSchemeInteractions;

WeSchemeInteractions = (function () {
    'use strict';

    var Prompt, makeFreshId;
    var ISMAC = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)?true:false;
    var MODKEY = ISMAC? "Alt" : "Ctrl";


    // WeSchemeInteractions: div (WeSchemeInteractions -> void) -> WeScheme
    var WeSchemeInteractions = function(interactionsDiv, afterInit) {
        var that = this;
        this.interactionsDiv = jQuery(interactionsDiv);
        this.interactionsDiv.empty();

        this.resetters = [];

        this.previousInteractionsDiv = document.createElement("div");
        this.previousInteractionsTextContainers = {};
        this.interactionsDiv.append(this.previousInteractionsDiv);
        
        this.withColoredErrorMessages = true;

        setTimeout(function() {
            that.sayAndForget("Press F4 to toggle extra accessibility features");
        }, 1000);

        new Prompt(
            this,
            this.interactionsDiv,
            function(prompt) {
                that.prompt = prompt;
                makeFreshEvaluator(that, function(e) {
                    that.evaluator = e;
                    that.highlighter = function(id, offset, line, column, span, color) {
                        // default highlighter does nothing.  Subclasses will specialize that.
                    };

                    // Note: When starting a new prompt, the last element of
                    // "historyArray" is always {code: "", output: false}, and "historyIndex"
                    // is the index of the last element in "historyArray".
                    // When recalling history, the last code element of "historyArray"
                    // can be set to the line being edited (if different from the
                    // history it recalls), so that a user can back out of the
                    // history recall to return to the edited line.
                    prompt.historyArray = [{code: "", output: false}];
                    prompt.historyIndex = 0;
                    prompt.maxSavedHistory = 100;

                    if (afterInit) {
                        afterInit(that);
                    }
                });
            }
        );
    };

    // reset: -> void
    // Clears out the interactions.
    WeSchemeInteractions.prototype.reset = function() {
        var that = this;
        this.notifyBus("before-reset", this);
        var i;
        // We walk the resetters backwards to allow resetters
        // to remove themselves during iteration.
        for (i = that.resetters.length - 1; i>= 0; i--){
            that.resetters[i]();
        }

        silenceCurrentEvaluator(that);
        makeFreshEvaluator(that, function(e) {
            that.evaluator = e;
            jQuery(that.previousInteractionsDiv).empty();
            that.notifyBus("after-reset", that);
            that.prompt.clear();
        })
    };

    // Wrap a callback so that it does not apply if we have reset
    // the console already.
    var withCancellingOnReset = function(that, f) {
        var cancelled = false;
        var onReset = function() { 
            cancelled = true; 
            that.removeOnReset(onReset);
        };
        that.addOnReset(onReset);
        return function() {
            if (cancelled) { return; }
            f.apply(null, arguments);
        };
    };


    WeSchemeInteractions.prototype.disableColoredErrorMessages = function() {
        this.withColoredErrorMessages = false;
    };

    // Sets the text in the prompt.
    WeSchemeInteractions.prototype.setPromptText = function(t) {
        this.prompt.setText(t);
    };

    // announce a msg by prepending it to the log, then (optionally) forget it by deleting
    WeSchemeInteractions.prototype.say = function(msg, forget) {
        if(msg==='') return;
        console.log(msg);
        var announcements = document.getElementById("announcementlist");
        var li = document.createElement("LI");
        li.appendChild(document.createTextNode(msg));
        announcements.insertBefore(li, announcements.firstChild);
        if(forget) { 
            setTimeout(function(){
                announcements.removeChild(li);
            }, 1000);
        }
    }
    WeSchemeInteractions.prototype.sayAndForget = function(msg) {
        this.say(msg, true);
    }

    WeSchemeInteractions.prototype.speakChar = function(cm) {
        var pos = cm.getCursor(), ln = pos.line, ch = pos.ch;
        var c = cm.getRange({line: ln, ch: ch}, {line: ln, ch: ch+1});
        this.sayAndForget(c);
    }

    // speak the nth interaction and result (0=10)
    WeSchemeInteractions.prototype.speakHistory = function(n) {
        if(n===0) { n = 10; }// use 0 as 10
        var historySize = this.prompt.historyArray.length-1; // the last elt is always ""
        if(n > historySize) { return false; } // don't speak a history that doesn't exist!
        var history = this.prompt.historyArray[historySize - n];
        this.sayAndForget(history.code + (history.output? 
            " evaluates to " + (history.output.ariaText || history.output.textContent)
          : " did not produce any value"));
        return true;
    }

    //////////////////////////////////////////////////////////////////////
    Prompt = function(interactions, parentDiv, K) {
        var that = this;
        this.interactions = interactions;
        this.div = jQuery("<div style='clear: left;'><span class='top-aligned-inline-block' aria-hidden='true'>&gt;&nbsp;</span><span class='top-aligned-inline-block' style='position: absolute; left: 20px; right: 5px;'/></div>");
        parentDiv.append(this.div);

        var innerDivElt = this.div.find("span").get(1);
        new plt.wescheme.WeSchemeTextContainer(
            innerDivElt,
            { dynamicHeight: true,
              lineNumbers: false,
              autoCloseBrackets: true,
              //stylesheet: "/js/codemirror/contrib/scheme/css/schemecolors-interactive.css",
              makeTransparentIframe: true,
              extraKeys: {
                  "Enter":function (ed) {
                      if (that.hasCompleteExpression()) {
                          that.onEvaluation();
                      } else {
                        CodeMirror.commands.newlineAndIndent(ed);
                      }
                  },
                  "Shift-Enter": function(ed) {
                    CodeMirror.commands.newlineAndIndent(ed);
                  },
                  "Alt-Down":function (ed) {
                      that.onHistoryNext();
                  },
                  "Alt-Up":function (ed) {
                      that.onHistoryPrevious();
                  },
                  // On ChromeBooks, Alt-Up/Down is PageUp/Down
                  "PageDown":function (ed) {
                      that.onHistoryNext();
                  },
                  "PageUp":function (ed) {
                      that.onHistoryPrevious();
                  },
                  // speak characters for screenreaders that don't know how
                  // based on https://github.com/ds26gte/code.pyret.org/commit/9e39b1109218331e60079b4853fa83cd007fa3b5
                  'Left': function(cm) { 
                      cm.moveH(-1, 'char'); interactions.speakChar(cm); 
                  },
                  'Right': function(cm) { 
                      cm.moveH(1, 'char'); interactions.speakChar(cm); 
                  },
                  // Speak history keys
                  "Alt-1":function (ed) {
                      interactions.speakHistory(1);
                  },
                  "Alt-2":function (ed) {
                      interactions.speakHistory(2);
                  },
                  "Alt-3":function (ed) {
                      interactions.speakHistory(3);
                  },
                  "Alt-4":function (ed) {
                      interactions.speakHistory(4);
                  },
                  "Alt-5":function (ed) {
                      interactions.speakHistory(5);
                  },
                  "Alt-6":function (ed) {
                      interactions.speakHistory(6);
                  },
                  "Alt-7":function (ed) {
                      interactions.speakHistory(7);
                  },
                  "Alt-8":function (ed) {
                      interactions.speakHistory(8);
                  },
                  "Alt-9":function (ed) {
                      interactions.speakHistory(9);
                  },
                  "Alt-0":function (ed) {
                      interactions.speakHistory(0);
                  }
              }},
            function(container) {
                that.textContainer = container;

                if (K) {
                    K(that);
                }
            });
    };

    Prompt.prototype.onEvaluation = function() {
        this.saveHistoryWithCleanup();
        var that = this;
        var nextCode = that.textContainer.getCode();
        that.textContainer.setCode("");

        var parentDiv = document.createElement('div');

        var promptSpan = document.createElement('span');
        promptSpan.className = 'top-aligned-inline-block';
        promptSpan.appendChild(document.createTextNode(">"));


        var textareaSpan = document.createElement("span");
        textareaSpan.className = 'top-aligned-inline-block';
        textareaSpan.style.width = '90%';

        parentDiv.appendChild(promptSpan);
        parentDiv.appendChild(document.createTextNode(" "));
        parentDiv.appendChild(textareaSpan);
        that.interactions.addToInteractions(parentDiv);
                        
        // ARIA: don't read the caret
        promptSpan.setAttribute("aria-hidden", "true");

        // // FIXME: figure out how to get the line height
        // dynamically, because I have no idea how to do
        // this correctly at the moment.
        var n = new plt.wescheme.WeSchemeTextContainer(
            textareaSpan,
            {   dynamicHeight: true,
                lineNumbers: false,
                content: nextCode,
                makeTransparentIframe: true,
                readOnly: true,     // sets CM to readOnly mode, but still blinks the cursor
                cursorBlinkRate: 0, // hides the cursor
                inputStyle: "contenteditable", // ACCESSIBILITY: this hurts performance, but improves support for screen readers
                matchBrackets: true,
                autoCloseBrackets: true },
            function(container) {
                var newId = makeFreshId();
                that.interactions.previousInteractionsTextContainers[newId] = container;
                that.interactions.runCode(nextCode, newId, function() {});
            });
            that.focus();
    };

    function historyPreviousIsOk(index, length) {
        return (index > 0);
    }

    function historyNextIsOk(index, length) {
        return ((length - index) > 1);
    }

    Prompt.prototype.onHistoryPrevious = function() {
        this.doHistory(-1, historyPreviousIsOk);
    };

    Prompt.prototype.onHistoryNext = function() {
        this.doHistory(1, historyNextIsOk);
    };

    Prompt.prototype.doHistory = function(increment, incrementIsOk) {
        if (this.historyArray.length > 1) {
            var code = jQuery.trim(this.textContainer.getCode());
            if (code === this.historyArray[this.historyIndex].code) {
                // The code *is* the same as the history slot, so do the increment if OK.
                if (incrementIsOk(this.historyIndex, this.historyArray.length)) {
                    this.doHistoryPart2(increment);
                }
            } else {
                // The code is *not* the same as the history slot, so,
                // if increment will be OK if we update the last slot
                // with the current code, then update the last slot and
                // then do the increment.
                var tentativeIndex = (this.historyArray.length - 1);
                if (incrementIsOk(tentativeIndex, this.historyArray.length)) {
                    this.historyIndex = tentativeIndex;
                    this.historyArray[this.historyIndex].code = code;
                    this.doHistoryPart2(increment);
                }
            }
        }

    };

    Prompt.prototype.doHistoryPart2 = function(increment) {
        this.historyIndex += increment;
        var dom = this.textContainer.getDiv();
        this.interactions.say(this.historyArray[this.historyIndex].code);
        this.textContainer.setCode(this.historyArray[this.historyIndex].code);
        this.textContainer.setCursorToEnd();
    };

    Prompt.prototype.saveHistoryWithCleanup = function() {
        var newEntry = jQuery.trim(this.textContainer.getCode());
        var lastIndex = (this.historyArray.length - 1);
        this.historyArray[lastIndex].code = newEntry;
        var prevEntry = ((lastIndex < 1) ? null : this.historyArray[lastIndex - 1].code);
        if (prevEntry && (prevEntry === newEntry)) {
            // The new entry is the same as the previous, so fall through and
            // let the new entry be reset to a blank.
        } else if (newEntry === "") {
            // New entry is already blank, so don't need to add a new one.
        } else {
            // Need to add a blank to historyArray, so shrink historyArray
            // if necessary, and then add blank.
            var shiftCount = Math.max(0, (this.historyArray.length - this.maxSavedHistory));
            while (shiftCount > 0) {
                this.historyArray.shift();
                shiftCount--;
            }
            // Note: We are setting lastIndex to one greater than the
            // current last index, so that our use of it in as an array
            // index in lhs of assignment below will result in appending to
            // the array.
            lastIndex = this.historyArray.length;
        }
        this.historyArray[lastIndex] = {code: "", output: false};
        this.historyIndex = lastIndex;
    };

    // setRecentOutput : DOM -> Void
    Prompt.prototype.setRecentOutput = function(dom) {;
        if((this.historyIndex > 0) && (this.historyIndex < this.historyArray.length)) {
            this.historyArray[this.historyIndex - 1].output = dom;
        }
    }

    // hasExpressionToEvaluate: -> boolean
    // Return true if the prompt contains a complete expression
    Prompt.prototype.hasCompleteExpression = function() {
        return plt.wescheme.tokenizer.hasCompleteExpression(this.textContainer.getCode());
    };



    Prompt.prototype.setText = function(t) {
        this.textContainer.setCode(t);
    };

    Prompt.prototype.clear = function() {
        this.textContainer.setCode("");
    };

    Prompt.prototype.getDiv = function() {
        return this.div;
    };

    Prompt.prototype.hide = function() {
        this.div.hide();
    };

    Prompt.prototype.show = function() {
        this.div.show();
    };

    Prompt.prototype.focus = function() {
        this.interactions._scrollToBottom();
        this.textContainer.focus();
    };


    //////////////////////////////////////////////////////////////////////


    // Initializes the evaluator to use round-robin compilation, given a list of
    // servers.
    // TODO: compilation_servers shouldn't exist anymore
    var compilation_servers = [];


    // Configures the evaluator to use round-robin compilation between
    // a set of servers.  Compilation will also fall back to other
    // servers under network failure.
    WeSchemeInteractions.prototype.initializeRoundRobinCompilation = function(evaluator, after) {
        var that = this;
        plt.wescheme.RoundRobin.initialize(
            compilation_servers,
            function() {
                evaluator.setCompileProgram(
                    plt.wescheme.RoundRobin.roundRobinCompiler);
                after();
            },
            function() {
                // Under this situation, all compilation servers are inaccessible.
                evaluator.setCompileProgram(
                    plt.wescheme.RoundRobin.roundRobinCompiler);
                alert("WeScheme appears to be busy or unavailable at this time." +
                      "  Please try again later.");
                after();
            });
    };
                        
    // calculateWidth : node -> number
    // cache and return the width of the current node, and all of its children
    function calculateWidth(node){
        node.cachedWidth = 1;
        for(var i = 0; i < node.children.length; i++) {
            node.cachedWidth += (node.children[i].cachedWidth || calculateWidth(node.children[i]));
        }
        node.cachedWidth = Math.max(node.cachedWidth, node.offsetWidth);
        return node.cachedWidth;
    }
                        
    // rewrap the REPL output according to DrRacket's conventions
    // compare width of the line to the interactions window
    // If the wrapping status has changed, re-check- all the children
    var rewrapOutput = function(node){
      var oldWrap   = (node.className.indexOf("wrapped") > -1),    // original wrap state
          width     = node.cachedWidth || calculateWidth(node),   // current width (use cache if possible)
          maxWidth  = document.getElementById('inter').offsetWidth,// maximum width
          newWrap   = width > maxWidth;                           // should we wrap?
      if((!oldWrap && newWrap) || (oldWrap && !newWrap)){
         node.className=newWrap? node.className+" wrapped" : node.className.replace(/ wrapped/g, "");
         for(var i = 0; i < node.children.length; i++){ rewrapOutput(node.children[i]); }
      }
    }

    // rewrap all REPL content onresize, throttled by 250ms
    var rewrapThrottle = null;
    var rewrapPreviousInteractions = function(){
      clearTimeout(rewrapThrottle);
      rewrapThrottle = setTimeout(function(){
         var repls = document.getElementsByClassName('replOutput');
         for(var i=0; i<repls.length; i++){ rewrapOutput(repls[i])};
       }, 250);
    }
    jQuery(window).bind('resize', rewrapPreviousInteractions);
                        

    var silenceCurrentEvaluator = function(that) {
        that.evaluator.write = function(thing) {};
        that.evaluator.transformDom = function(thing) {};
        that.evaluator.requestBreak();
    };


    var makeFreshEvaluator = function(that, afterInit) {         
        var evaluator = new Evaluator({
            write: function(thing) {
                var ariaText = thing.ariaText || thing.innerText;
                // if it's a canvas element, make double-clicking generate an image file in a new window
                // use Blobs instead of dataURL, since some browser/OS combos choke on Very Long URLs
                // see https://code.google.com/p/chromium/issues/detail?id=69227
                if(thing.nodeName === "CANVAS" && window.Blob !== undefined){
                    thing.ondblclick = function(){
                                        var dataURL = thing.toDataURL(),
                                            parts = dataURL.match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/),
                                            binStr = atob(parts[3]),              // assume base64 encoding
                                            buf = new ArrayBuffer(binStr.length), // initialize a blob
                                            view = new Uint8Array(buf);
                                          // copy the dataURL into the blob
                                          for(var i = 0; i < view.length; i++){ view[i] = binStr.charCodeAt(i); }
                                          var blob = new Blob([view], {'type': parts[1]});
                                      
                                        // if msSaveBlob is supported (IE10+), use that
                                        if(window.navigator.msSaveBlob != undefined){
                                          window.navigator.msSaveBlob(blob, "WeScheme Image");
                                        // try to download, or at least open in a new tab (Safari/FF/Chrome)
                                        } else {
                                          var link = document.createElement("a");
                                          link.href = (URL || webkitURL).createObjectURL(blob);
                                          link.target = link.download = "WeScheme Image";
                                          document.body.appendChild(link);  // for firefox
                                          link.click();
                                          document.body.removeChild(link);  // clean up firefox
                                        }
                                      };
                    thing.style.cursor    = "url(css/images/dblclick.png), pointer";
                }
                thing.className += " replOutput";
                thing.setAttribute("aria-label", ariaText);
                that.addToInteractions(thing);
                that.sayAndForget(ariaText);
                if(ariaText !=="") that.prompt.setRecentOutput(thing);
                rewrapOutput(thing);
            },
            transformDom : function(dom) {
                var result = that._transformDom(dom);
                return result;
            }
        });

        var dialog = jQuery("<div/>");
                        
        that.initializeRoundRobinCompilation(
            evaluator,
            function() {
                evaluator.makeToplevelNode = function() {
                    // block screen-readers
                    document.getElementById('editor').setAttribute('aria-hidden', true);
                    var handleClose = function(event, ui) {
                        // unblock screen-readers
                        document.getElementById('editor').removeAttribute('aria-hidden');
                        that.evaluator.requestBreak();
                        dialog.dialog("destroy");
                    };

                    dialog.dialog( {
                        bgiframe : true,
                        position: {my: "left top", at:"left top"},
                        modal : true,
                        width: "auto",
                        height: "auto",
                        beforeClose: handleClose,
                        resizable: false,
                        closeOnEscape: true
                    });
                                             
                    // set the CSS of the dialog to absolute - fixes keypress bug when in fullscreen
                    dialog.get(0).parentNode.style.position = "absolute";

                    var supportsFullScreen = function() {
                        var elem = document.createElement("div");
                        return ((elem.webkitRequestFullscreen
                                || elem.mozRequestFullScreen
                                || elem.msRequestFullscreen
                                || elem.requestFullscreen) !== undefined);
                    };

                    var toggleFullScreen = function(evt) {
                        var elem;
                        // if this is in response to a double-click, trap the event so it
                        // doesn't bubble through to big-bang
                        if(evt){
                           evt.stopPropagation();
                           evt.preventDefault();
                        }
                                             
                        // If there's a unique canvas, highlight that one.
                        // Otherwise, just highlight the whole toplevel node.
                        elem = innerArea.get(0);//(innerArea.find("canvas").length === 1)? innerArea.find("canvas").get(0)
                                             //: innerArea.get(0);
                                       
                        // assign fullscreen functions to be be native, or the vendor-prefixed function
                        elem.requestFullscreen = elem.requestFullscreen
                                              || elem.mozRequestFullScreen // firefox capitalizes the 'S'
                                              || elem.webkitRequestFullscreen
                                              || elem.msRequestFullscreen;
                        document.exitFullscreen = document.exitFullscreen
                                              || document.webkitExitFullscreen
                                              || document.msExitFullscreen
                                              || document.mozCancelFullScreen;  // firefox is weird

                        function getFullscreenElement(){
                            return   document.fullscreenElement
                                  || document.mozFullScreenElement // firefox capitalizes the 'S'
                                  || document.webkitFullscreenElement
                                  || document.msFullscreenElement;
                        }
                        // If there's no fullscreen element, we know that there WILL be one, so disable closeOnEsc
                        var closeOnEscape = getFullscreenElement();
                        dialog.dialog( "option", "closeOnEscape", closeOnEscape );

                       // get fullscreen access
                       if(!getFullscreenElement()) elem.requestFullscreen( Element.ALLOW_KEYBOARD_INPUT );
                       else document.exitFullscreen();
                    };

                    // if fullscreen is supported, add the 'maximize' icon and listen for double-clicks
                    if (supportsFullScreen()) {
                        jQuery("<span><img src='/images/fullscreen.png' style='position: absolute;'></span>")
                            .css("margin-top", "5px")
                            .css("background-image", "none")
                            .css("position", "absolute")
                            .css("cursor", "pointer")
                            .css("left", "2em")
                            .click(toggleFullScreen)
                            .appendTo(dialog.parent().find(".ui-dialog-titlebar"));
                        dialog.dblclick(toggleFullScreen);
                    }

                    var innerArea = jQuery("<div class='evaluatorToplevelNode' role='log' aria-live='polite'></div>");
                    innerArea.css("background-color", "white");
                    // make sure there are no other topLevelEvaluationNodes
                    while(dialog[0].firstChild) dialog[0].removeChild(dialog[0].firstChild);
                    dialog.append(innerArea);
                    dialog.dialog("open");
                    return innerArea.get(0);
                };
                evaluator.setImageProxy("/imageProxy");
                evaluator.setRootLibraryPath("/js/mzscheme-vm/collects");
                evaluator.setDynamicModuleLoader(plt.wescheme.makeDynamicModuleLoader("/js/mzscheme-vm/collects"));
                afterInit(evaluator);
            }); 
    };


    WeSchemeInteractions.prototype.focusOnPrompt = function() {
        this.prompt.focus();
    };

    WeSchemeInteractions.prototype.notifyBus = function(action, data) {
        if (typeof plt.wescheme.WeSchemeIntentBus != 'undefined') {
            plt.wescheme.WeSchemeIntentBus.notify("after-reset", this);
        }
    };


    //FIXME refactor this
    WeSchemeInteractions.prototype.setSourceHighlighter = function(highlighter) {
        this.highlighter = highlighter;
    };
    
    WeSchemeInteractions.prototype.setAddToCurrentHighlighter = function(addToCurrentHighlighter) {
        this.addToCurrentHighlighter = addToCurrentHighlighter;
    };

    WeSchemeInteractions.prototype.setMoveCursor = function(moveCursor) {
        this.moveCursor = moveCursor;
    };

    WeSchemeInteractions.prototype.setScrollIntoView = function(scrollIntoView) {
        this.scrollIntoView = scrollIntoView;
    };

    WeSchemeInteractions.prototype.addSetSelection = function(setSelection) {
        this.setSelection = setSelection;
    };

    WeSchemeInteractions.prototype.setFocus = function(focus) {
        this.focus = focus;
    };

    WeSchemeInteractions.prototype.focus = function() {
        this.prompt.focus();
    };

    WeSchemeInteractions.prototype.addOnReset = function(onReset) {
        this.resetters.push(onReset);
    };

    WeSchemeInteractions.prototype.removeOnReset = function(onReset) {
        var i;
        for (i = 0; i < this.resetters.length; i++) {
            if (onReset === this.resetters[i]) {
                this.resetters.splice(i, 1);
                return;
            }
        } 
    };

    // Returns if x is a dom node.
    function isDomNode(x) {
        return (x.nodeType != undefined);
    }

    // addToInteractions: string | dom-node -> void
    // Adds a note to the interactions.
    WeSchemeInteractions.prototype.addToInteractions = function (interactionVal) {
        var that = this;
        var domNode;
        // inform any potential screen-reader about the new value
        // NOTE: it's up to the element to describe itself!
        this.notifyBus("before-add-to-interactions", this);
        if (isDomNode(interactionVal)) {
            domNode = jQuery(interactionVal);
            domNode.click(function(e){ e.stopPropagation(); });
            jQuery(this.previousInteractionsDiv).append(domNode);
        } else {
            domNode = jQuery("<div style='width: 100%'></div>");
            domNode.text(interactionVal);
            domNode.click(function(e) { e.stopPropagation(); });
            jQuery(this.previousInteractionsDiv).append(domNode);
        }
        this._scrollToBottom();
        this.notifyBus("after-add-to-interactions", this);
    };



    WeSchemeInteractions.prototype._scrollToBottom = function() {
        this.interactionsDiv.attr(
            "scrollTop", 
            this.interactionsDiv.attr("scrollHeight"));
    };

    WeSchemeInteractions.prototype._transformDom = function(dom) {
        if (helpers.isLocationDom(dom)) {
            return this._rewriteLocationDom(dom);
        } else {
            return dom;
        }
    };

    WeSchemeInteractions.prototype._rewriteLocationDom = function(dom) {
        var newDom = document.createElement("span");
        var children = dom.children;
        var offset, id, span, line, column, color;
        for (var i = 0; i < children.length; i++) {
            var textBody = children[i].textContent || children[i].innerText;
            if (children[i]['className'] === 'location-id') {
                id = textBody;
            }
            if (children[i]['className'] === 'location-offset') {
                offset = textBody;
            }
            if (children[i]['className'] === 'location-span') {
                span = textBody;
            }
            if (children[i]['className'] === 'location-line') {
                line = textBody;
            }
            if (children[i]['className'] === 'location-column') {
                column = textBody;
            }
            if (children[i]['className'] === 'location-color') {
                color = textBody;
            }

        }
         if(!color) { color = "red"; }
        return this.createLocationHyperlink({ id: id,
                                              offset: parseInt(offset),
                                              line: parseInt(line),
                                              column: parseInt(column),
                                              span: parseInt(span),
                                              color: color});
    };

    // Evaluate the source code and accumulate its effects.
    WeSchemeInteractions.prototype.runCode = function(aSource, sourceName, contK) {
        var that = this;
        // ugly hack to make sure that focus is returned to wherever it
        // was before the Run command was initiated
        function putFocus(){
            var defInFocus = plt.wescheme.WeSchemeEditor.defnInFocus;
            if(defInFocus) jQuery("#definitions").click();
            else that.focusOnPrompt();
        }
        // reset state tracking the presence of a compile-time error
        if(sourceName == "<definitions>") that.compileTimeError = false;
        setTimeout(
            withCancellingOnReset(
                that,
                function() {
                    that.notifyBus("before-run", that);

                    that.disableInput();
                    that.evaluator.executeProgram(
                        sourceName,
                        aSource,
                        withCancellingOnReset(
                            that,
                            function() { 
                                that.enableInput();
                                putFocus();
                                contK();
                            }),
                        withCancellingOnReset(
                            that,
                            function(err) {
                                that.handleError(err); 
                                that.enableInput();
                                // uh oh! Compile-time error! Log for any subsequent errors
                                if(sourceName == "<definitions>") that.compileTimeError = true;
                                putFocus();
                                contK();
                            }));
                }),
            0);
    };

    WeSchemeInteractions.prototype.handleError = function(err) {
        var dom = renderErrorAsDomNode(this, err);
        this.addToInteractions(dom);
        this.say(dom.textContent);
        this.prompt.setRecentOutput(dom);
        this.addToInteractions("\n");
    };

    //nextColor: int float -> int
    //takes in a rgb color from 0 to 255 and a percentage from 0 to 1 to tint by, 
    //  outputs the tinted color as an int
    var nextColor = function(color, percentage) {
        return Math.floor(percentage*color + (255 * (1 - percentage)));
    };
    
    //nextTint: int int int float -> string
    //given rgb ints and a percentage to tint, returns the rgb string of the tinted color
    var nextTint = function(red, green, blue, percentage) {
        return "rgb(" + nextColor(red, percentage) + "," + nextColor(green, percentage) + "," 
                      + nextColor(blue, percentage) + ")";
    };
 
    
    var Color = function(red, green, blue) {
        this.red = red;
        this.green = green;
        this.blue = blue;
    };
    
    Color.prototype.toString = function() {
       return "rgb(" + this.red +"," + this.green + "," + this.blue + ")";
      
    };

    //proper order is id offset line column span
    //badLocs is in   col id line offset span
   var locObjToVector = function(badLocs) {
        return types.vector([badLocs.id,
                     parseInt(badLocs.offset),
                     parseInt(badLocs.line),
                     parseInt(badLocs.column),
                     parseInt(badLocs.span)]);
   };

    //return array of fixed locs
   var fixLocList = function(badLocList) {
       var toReturn = [];

       var i;
       for (i =0; i < badLocList.length; i++) {
           toReturn.push(locObjToVector(badLocList[i]));
       }
       return toReturn;
   };

    //structuredError -> Message
    var structuredErrorToMessage = function(se) {
        var msg = [];
        var i;
        for(i = 0; i < se.length; i++){
            if(typeof(se[i]) === 'string') {
                msg.push(se[i]);
            }
            else if(se[i].type === "ColoredPart"){
                msg.push(new types.ColoredPart(se[i].text, locObjToVector(se[i].loc)));
            }

            else if(se[i].type === "GradientPart"){
                var j;
                var parts = [];
                for(j = 0; j < se[i].parts.length; j++){
                    var coloredPart = se[i].parts[j];
                    parts.push(new types.ColoredPart(coloredPart.text, locObjToVector(coloredPart.loc)));
                }
                msg.push(new types.GradientPart(parts));
            }
            else if(se[i].type === "MultiPart"){
                msg.push(new types.MultiPart(se[i].text, fixLocList(se[i].locs), se[i].solid));
            }
            else msg.push(se[i]+'');
        }
        return new types.Message(msg);
    };

    // that: ???
    // msgDom: dom.  The target element that we write output to.
    // args: arrayof (U string ColoredPart GradiantPart MultiPart)
    // Special multi-color highlighting
    var formatColoredMessage = function(that, msgDom, msg) {
        var args = msg.args;

        // These colors are different versions of the same color, used
        // for gradient purposes to allow for greater differentiation
        // between nearby colors.  The first element in each sublist
        // is the primary color.
        // 
        // Most of these colors come from:
        // http://en.wikipedia.org/wiki/Web_colors
        var colors = [
            // shades of blue: SkyBlue, LightSteelBlue, PowderBlue, LightBlue
            [new Color(135, 206, 235), new Color(176, 196, 222), new Color(176, 224, 230), new Color(173, 216, 230)],

            // shades of purple: Violet, Thistle, Plum,  Orchid
            [new Color(238, 130, 238), new Color(216, 191, 216), new Color(221, 160, 221), new Color(218, 112, 214)],

            // shades of yellow: Moccasin, PaleGoldenrod, PeachPuff
            [new Color(255, 228, 181), new Color(238, 232, 170), new Color(255, 218, 185)],

            // // shades of cyan: PaleTurquoise, Aquamarine, Turquoise
            // [new Color(175, 238, 238), new Color(127, 255, 212), new Color(64, 224, 208)],

            // shades of brown: BurlyWood, Bisque, NavajoWhite, Wheat
            [new Color(222, 184, 135), new Color(255, 228, 196), new Color(255, 222, 173), new Color(245, 222, 179)]   
        ];



        var colorIndex = 0;
        var currColor = colors[colorIndex][0];
        var i;

        // Helper: iterate across elts, and pick a new tint.  Apply f on each elt with that new tint.
        var foreachTint = function(elts, f) {
            var currTint;
            var altIndex = 0;
            var j;
            var percentage = 1;
            var change = 2/(elts.length+1);
            for (j = 0; j < elts.length; j++){
                if (altIndex >= colors[colorIndex].length) {
                    altIndex = 0;
                    percentage = percentage - change;
                }
                currColor = colors[colorIndex][altIndex];
                currTint = nextTint(currColor.red, currColor.green, currColor.blue, percentage);
                f(elts[j], currTint);
                altIndex++;
            }
        };

        var doColoredPart = function(part) {
            colorAndLink(that, msgDom, currColor, part.text, [currColor], [part.location]);
            colorIndex = (colorIndex + 1) % colors.length;
        };

        var doGradientPart = function(part) {
            var parts = part.coloredParts;
            foreachTint(parts,
                        function(subpart, currTint) {
                            colorAndLink(that, msgDom, currTint, subpart.text, [currTint], [subpart.location])
                        });
            colorIndex = (colorIndex + 1) % colors.length;
        };

        var doMultiPart = function(part) {
            var locTints = [];
            var i;
            var baseColor = currColor;
            var box;
            if(part.locations.length > 0){ 
                if (part.solid || part.locations.length === 1) {
                    for (i = 0; i < part.locations.length; i++) {
                        locTints.push(baseColor);
                    }
                    colorAndLink(that, msgDom, baseColor, part.text, 
                                 locTints, part.locations);
                    colorIndex = (colorIndex + 1) % colors.length;
                    
                } else {
                    foreachTint([undefined].concat(part.locations),
                                function(loc, tint) {
                                    locTints.push(tint);
                                });
                    colorAndLink(that, msgDom, baseColor, part.text, 
                                 locTints.slice(1), part.locations);
                    jQuery(msgDom).append("\u00ab"); // left-pointing-double-angle quotation mark
                    for (i = 0; i < part.locations.length; i++) {
                        box = jQuery("<tt/>");
                        // white large box character.
                        // http://www.fileformat.info/info/unicode/char/2b1c/index.htm
                        box.text("\u2b1c"); 
                        colorAndLink(that, msgDom, locTints.slice(1)[i], 
                                     box, [locTints.slice(1)[i]], [part.locations[i]]);
                    }
                    jQuery(msgDom).append("\u00bb"); // right-pointing-double-angle quotation mark
                    colorIndex = (colorIndex + 1) % colors.length;
                }
            } else {
                msgDom.appendChild(document.createTextNode(part.text+''));
            }
        };

        var doPlainPart = function(part) {
            msgDom.appendChild(document.createTextNode(part+''));
        };
        for (i = 0; i < args.length; i++){
            currColor = colors[colorIndex][0];
            if (types.isColoredPart(args[i])) {
                doColoredPart(args[i]);
            } else if(types.isGradientPart(args[i])) {
                doGradientPart(args[i]);
            } else if(types.isMultiPart(args[i])) {
                doMultiPart(args[i]);
            } else {
                doPlainPart(args[i]);
            }
        }
    };


    // that: ???
    // msgDom: dom.  The target element that we write output to.
    // args: arrayof (U string ColoredPart GradiantPart MultiPart)
    // Disabled multi-colored highlighting.
    var formatUncoloredMessage = function(that, msgDom, msg, errorLoc) {
        var args = msg.args;
        var i;

        var pinkColor = new Color(240,181,194);

        var doColoredPart = function(part) {
            msgDom.appendChild(document.createTextNode(part.text));
        };
        var doGradientPart = function(part) {
            var parts = part.coloredParts;
            var i;
            for (i = 0; i < parts.length; i++) {
                msgDom.appendChild(document.createTextNode(parts[i].text+''));
            }
        };

        var doMultiPart = function(part) {
            msgDom.appendChild(document.createTextNode(part.text+''));
        };

        var doPlainPart = function(part) {
            msgDom.appendChild(document.createTextNode(part+''));
        };

        for (i = 0; i < args.length; i++){
            if (types.isColoredPart(args[i])) {
                doColoredPart(args[i]);
            } else if(types.isGradientPart(args[i])) {
                doGradientPart(args[i]);
            } else if(types.isMultiPart(args[i])) {
                doMultiPart(args[i]);
            } else {
                doPlainPart(args[i]);
            }
        }

        that.addToCurrentHighlighter(errorLoc.id,
                                     errorLoc.offset, 
                                     errorLoc.line,
                                     errorLoc.column, 
                                     errorLoc.span,
                                     pinkColor+"");
    };




    //that, dom, Color, string, nonempty array[loc]
    //does the coloring and makes a link to the location in the definitions
    var colorAndLink = function(that, msgDom, errorColor, text, locColors, locs) {
        var i;
        var x;
        var pieces = [];
        if (typeof text === 'string') {
            text = jQuery("<span/>").text(text);
        }
        for(i = 0; i < locs.length; i++){
            pieces.push(that.addToCurrentHighlighter(locs[i].ref(0), locs[i].ref(1), locs[i].ref(2), locs[i].ref(3), locs[i].ref(4), 
                                                     locColors[i]+''));
        }
        if(locs[0].ref(0) === "<no-location>"){
            jQuery(msgDom).append(text);
        } else {
            var clickFunction = makeCursorLink(that, locs, pieces, errorColor);
            var aChunk = jQuery("<span/>").css("background-color", errorColor+'')
                                          .addClass("colored-link")
                                          .click(clickFunction);
            var aLink = jQuery("<a/>").append(text)
                                      .attr("href", "#")
                                      .click(clickFunction);
            jQuery(aChunk).append(aLink);
            jQuery(msgDom).append(aChunk);
        }
    };

    //WeSchemeInteractions locations {find, clear, styleName} string -> function
    //takes in information, returns a function to run when clicked-
    //moves the cursor before the first piece, and catches the user's attention
    var makeCursorLink = function(that, locs, pieces, color) {
        var currItem = locs[0];
        return function(e) {
            var i;
            e.stopPropagation();
            e.preventDefault();
            that.scrollIntoView(currItem.ref(0), parseInt(currItem.ref(1)));
            that.focusOnPrompt();
            for(i = 0; i < pieces.length; i++){
                catchAttention(pieces[i].styleName);
            }
        }
    };

    //takes in style name, then for all elements with that style name,
    //fades them out and back in
    var catchAttention = function(styleName){
        var opacity = 0;
        var intervalId = setInterval(function() {
            jQuery("." + styleName).css("opacity", opacity);
            opacity = opacity + 0.02;                
            if (opacity >= 1) { clearInterval(intervalId); }
        }, 15);
    };


    // renderErrorAsDomNode: WeSchemeInteractions exception -> element
    // Given an exception, produces error dom node to be displayed.
    var renderErrorAsDomNode = function(that, err) {
        var msg;
        var i;
        var dom = document.createElement('div');
        if (types.isSchemeError(err) && types.isExnBreak(err.val)) {
            dom['className'] = 'moby-break-error';
            msg = "The program has stopped.";
        } 
        else {
            dom['className'] = 'moby-error';
            if(err.structuredError && err.structuredError.message) {
                msg = structuredErrorToMessage(err.structuredError.message);
            }
            else {
                msg = that.evaluator.getMessageFromExn(err);
            }
        }
        var msgDom = document.createElement('div');
        msgDom['className'] = 'moby-error:message';
        if(types.isMessage(msg)) {
            if (that.withColoredErrorMessages) {
                //if it is a Message, do special formatting
                formatColoredMessage(that, msgDom, msg);
            } else {
                formatUncoloredMessage(that, msgDom, msg, getPrimaryErrorLocation(that, err));
            }
        } else {
            if(err.domMessage){
              dom.appendChild(err.domMessage);
            } else {
              msgDom.appendChild(document.createTextNode(msg));
            }
        } 
        dom.appendChild(msgDom);

        if(err.structuredError && err.structuredError.message) {
            var link = that.createLocationHyperlink(err.structuredError.location);
            dom.appendChild(link);
        }
        var stacktrace = that.evaluator.getTraceFromExn(err);
        var stacktraceDiv = document.createElement("div");
        stacktraceDiv['className'] = 'error-stack-trace';
        for (i = 0; i < stacktrace.length; i++) {
            var anchor = that.createLocationHyperlink(stacktrace[i]);
            stacktraceDiv.appendChild(anchor);
        }
        
        // don't give a stack trace if the user halts the program
        if(!(types.isSchemeError(err) && types.isExnBreak(err.val))){
          dom.appendChild(stacktraceDiv);
        }
        // if there's been a compile-time error, warn the user
        if(that.compileTimeError) {
            var msg = "An error occured the last time Run was clicked. ";
            msg += "This may be causing the error you see here. "
            msg += "Make sure you fix the first error you see in the Interactions Area!"
            var span = document.createElement('span');
            span.className = "compileTimeError";
            console.log(msg);
            span.appendChild(document.createTextNode(msg));
            console.log(span);
            dom.appendChild(span);
        }
        console.log(dom);
        return dom;
    };


    // getPrimaryErrorLocation: error -> (U location false)
    // Try to get the primary error location.  Return false
    // if we can't localize it.
    var getPrimaryErrorLocation = function(that, err) {
        var i;
        if(err.structuredError && err.structuredError.message) {
            return err.structuredError.location;
        }
        var stacktrace = that.evaluator.getTraceFromExn(err);
        for (i = 0; i < stacktrace.length; i++) {
            return stacktrace[i];
        }
        return false;
    };


    // createLocationHyperlink: location (or dom undefined) -> paragraph-anchor-element
    // Produce a hyperlink that, when clicked, will jump to the given location on the editor.
    // FIXME: should this really wrap a paragraph around a link?  The client
    // really should be responsible for layout issues instead....
    WeSchemeInteractions.prototype.createLocationHyperlink = function(aLocation, anchorBodyDom) {
        if (! anchorBodyDom) {
            anchorBodyDom = document.createTextNode(
                "at: line " + aLocation.line + 
                    ", column " + aLocation.column +
                    ", in " + aLocation.id);
        }
        var para = document.createElement('p');
        para.className = 'location-paragraph';
        var anchor = document.createElement("a");
        anchor['href'] = "#";
        anchor['onclick'] = makeHighlighterLinkFunction(this, aLocation);
        anchor.appendChild(anchorBodyDom);
        para.appendChild(anchor);
        return para;
    };
    
    var makeHighlighterLinkFunction = function(that, elt) {
        return function() { 
            that.highlighter(elt.id, elt.offset, elt.line, elt.column, elt.span, "rgb(255, 200, 200)");
        };
    };

    WeSchemeInteractions.prototype.disableInput = function() {
        this.prompt.hide();
    };

    WeSchemeInteractions.prototype.enableInput = function() {
        this.prompt.show();
    };

    WeSchemeInteractions.prototype.requestBreak = function() {
        this.evaluator.requestBreak();
    };

    WeSchemeInteractions.prototype.toString = function() { return "WeSchemeInteractions()"; };

    //////////////////////////////////////////////////////////////////////
    var _idNum = 0;
    makeFreshId = function() {
        return ("<interactions" + (_idNum++) + ">");
    }
    //////////////////////////////////////////////////////////////////////

    return WeSchemeInteractions;
})();

plt.wescheme.WeSchemeInteractions = WeSchemeInteractions;