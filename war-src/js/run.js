// The code for the run page.  This has most of the evaluator from
// openEditor, but stripped down since it does not need to support
// interactive evaluation.

goog.provide("plt.wescheme.runner");

goog.require("plt.wescheme.AjaxActions");
goog.require("plt.wescheme.WeSchemeProperties");
goog.require("plt.wescheme.makeDynamicModuleLoader");
goog.require("plt.wescheme.RoundRobin");


/* BUGFIX:
 * 
 * These #includes are required by plt.wescheme.RoundRobin.
 * See round_robin.js for more details.
 */
goog.require('plt.compiler.lex');
goog.require('plt.compiler.parse');
goog.require('plt.compiler.desugar');
goog.require('plt.compiler.analyze');
goog.require('plt.compiler.compile');

var myEditor = myEditor || {getScreenreader:function(){return false;}};

(function() {

    var Runner = function(compilationServerUrl, interactionsDiv) {
        var that = this;
        this.interactionsDiv = jQuery(interactionsDiv);
        this.evaluator = new Evaluator({ write: function(thing) { that.addToInteractions(thing); },
                                        compilationServletUrl: compilationServerUrl
                                       });
        this.evaluator.setImageProxy("/imageProxy");
        this.evaluator.setRootLibraryPath("/js/mzscheme-vm/collects");
        this.evaluator.setDynamicModuleLoader(
            plt.wescheme.makeDynamicModuleLoader("/js/mzscheme-vm/collects"));
    };


    Runner.prototype.runCompiledCode = function(compiledCode, permStringArray) {
        var that = this;
        var onSuccessRun = function() { };
        var onFailRun = function(exn) { that.renderErrorAsDomNode(exn); };
        this.evaluator.executeCompiledProgram((0,eval)('(' + compiledCode + ')'),
                                              onSuccessRun,
                                              onFailRun);
    };

    Runner.prototype.runSourceCode = function(title, sourceCode, permStringArray) {
        var that = this;
        var onSuccessRun = function() { };
        var onFailRun = function(exn) { that.renderErrorAsDomNode(exn); };
        this.evaluator.executeProgram(title,
                                      sourceCode,
                                      onSuccessRun,
                                      onFailRun);
    };

    // Returns if x is a dom node.
    function isDomNode(x) {
        return (x.nodeType != undefined);
    }
    // Returns if x is a node that should be printed
    // Printable Nodes are CANVAS elements, OR non-empty SPANs
    function isPrintableNode(x){
      return x.nodeName === "CANVAS" || x.childNodes.length > 0;
    }

    Runner.prototype.addToInteractions = function (interactionVal) {
      if(!isPrintableNode(interactionVal)){ return;}      // make sure there are no other topLevelEvaluationNodes in the interactionsDiv
      while(this.interactionsDiv[0].firstChild){
        this.interactionsDiv[0].removeChild(this.interactionsDiv[0].firstChild);
      }
      if (isDomNode(interactionVal)) {
        interactionVal.style.display="inline-block";
        interactionVal.classList.add("replOutput");      // simulate the editor REPL, so CSS spacing will kick in
        this.interactionsDiv.append(interactionVal);
      } else {
        var newArea = jQuery("<div style='width: 100%'></div>");
        newArea.text(interactionVal);
        newArea.style.display="inline-block";
        this.interactionsDiv.append(newArea);
      }
      this.interactionsDiv.attr("scrollTop", this.interactionsDiv.attr("scrollHeight"));
    };

    // renderErrorAsDomNode: exception -> element
    // Given an exception, produces error dom node to be displayed.
    Runner.prototype.renderErrorAsDomNode = function(err) {
        var msg = this.evaluator.getMessageFromExn(err);

        var dom = document.createElement('div');
        dom['class'] = 'moby-error';

        var msgDom = document.createElement('div');
        msgDom['class'] = 'moby-error:message';
        msgDom.appendChild(document.createTextNode(msg));
        dom.appendChild(msgDom);

        var stacktrace = this.evaluator.getTraceFromExn(err);
        for (var i = 0; i < stacktrace.length; i++) {
          dom.appendChild(document.createTextNode("at: line " + stacktrace[i].line +
                                                  ", column " + stacktrace[i].column));
        }
        return dom;
    };


    // Configures the evaluator to use round-robin compilation between
    // a set of servers.  Compilation will also fall back to other
    // servers under network failure.
    var initializeRoundRobinCompilation = function(evaluator, after) {
        var that = this;
        // Initializes the evaluator to use round-robin compilation, given a list of
        // servers.
        // TODO: compilation_servers shouldn't exist anymore
        var compilation_servers = [];
        plt.wescheme.RoundRobin.initialize(
            compilation_servers,
            function() {
                evaluator.setCompileProgram(
                    plt.wescheme.RoundRobin.roundRobinCompiler);
                after();
            },
            () => {
                // Under this situation, all compilation servers are inaccessible.
                evaluator.setCompileProgram(plt.wescheme.RoundRobin.roundRobinCompiler);
                alert("WeScheme appears to be busy or unavailable at this time." +
                      "  Please try again later.");
                after();
            });
    };




    function init(compilationServerUrl, publicId) { 
      var runner = new Runner(compilationServerUrl, document.getElementById('interactions'));
      var afterLoad = function(aProgram) {
        var title = aProgram.getTitle(),
            sourceCode = aProgram.getSourceCode(),
            programCode = null, // Set it to null, so that the client-side compiler is invoked.
            permissions = aProgram.getPermissions(),
            notes       = aProgram.getNotes();
 
            var j = jQuery("#interactions"),
                b = document.getElementsByTagName("body")[0],
                desc = document.createElement("div"),
                titlespan = document.createElement("span"),
                notesspan = document.createElement("span");
 
            desc.id = "description";
            titlespan.id = "title";
            notesspan.id = "notes";
            titlespan.appendChild(document.createTextNode(title));
            notesspan.appendChild(document.createTextNode(notes));
 
            var supportsFullScreen = function() {
                var elem = document.createElement("div");
                return ((elem.webkitRequestFullscreen
                        || elem.mozRequestFullScreen
                        || elem.msRequestFullscreen
                        || elem.requestFullscreen) !== undefined);
            };
 
            var toggleFullscreen = function() {
              // obtain the element being added
              var elem;
              if (j.find("canvas").length == 1) { elem = j.find("canvas").get(0); }
              else { elem = j.get(0); }

              // assign fullscreen functions to be be native, or the vendor-prefixed function
              elem.requestFullscreen = elem.requestFullscreen
                                    || elem.mozRequestFullScreen // firefox capitalizes the 'S'
                                    || elem.webkitRequestFullscreen
                                    || elem.msRequestFullscreen;
              document.exitFullscreen = document.exitFullscreen
                                    || document.webkitExitFullscreen
                                    || document.msExitFullscreen
                                    || document.mozCancelFullScreen;  // firefox is weird
                                   
              var fullscreenElement = document.fullscreenElement
                                    || document.mozFullScreenElement // firefox capitalizes the 'S'
                                    || document.webkitFullscreenElement
                                    || document.msFullscreenElement;

              // get fullscreen access
              if(!fullscreenElement) elem.requestFullscreen( Element.ALLOW_KEYBOARD_INPUT );
              else document.exitFullscreen();
            };
            if(supportsFullScreen()) {
                jQuery("<input type='button' value='Run Fullscreen'>")
                    .css("margin-top", "20px")
                    .css("display", "block")
                    .css("margin-left", "auto")
                    .css("margin-right", "auto")
                    .click(toggleFullscreen)
                    .appendTo(b);
            }

            var appendFinishedMsg = function() {
                var inter = document.getElementById('interactions');
                var finished = document.createElement('span');
                finished.id = "finished";
                finished.innerHTML = "The program has finished running, but only included definitions (which do not produce any output).";
                if(inter.children.length == 0){
                    inter.appendChild(finished);
                }
            };
 
            b.insertBefore(titlespan, b.firstChild);
            desc.appendChild(notesspan);
            b.appendChild(desc);

            // Change the title of the document to that of the program.
            document.title = title;
            if (programCode) {
              runner.runCompiledCode(programCode, permissions);
              appendFinishedMsg();
            } else  {
                // Only do this if we have no other choice.
                initializeRoundRobinCompilation(runner.evaluator,
                                                function() {
                                                  runner.runSourceCode(title, sourceCode, permissions);
                                                });
                appendFinishedMsg();
            }
        };
        new plt.wescheme.AjaxActions().loadProject(
            null, publicId, afterLoad, function() { alert("unable to load program"); });
    }


    plt.wescheme.runner.Runner = Runner;
    plt.wescheme.runner.init = init;
}());
