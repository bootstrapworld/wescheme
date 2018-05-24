// if (typeof (plt) === 'undefined') {
//     this.plt = {};
// }
// if (typeof (plt.wescheme) === 'undefined') {
//     this.plt.wescheme = {};
// }

goog.provide('plt.wescheme.WeSchemeEditor');

goog.require('plt.wescheme.AjaxActions');
goog.require('plt.config');
goog.require('plt.wescheme.WeSchemeIntentBus');
goog.require('plt.wescheme.SharingDialog');
goog.require('plt.wescheme.NotesDialog');
goog.require('plt.wescheme.WeSchemeInteractions');
goog.require('plt.wescheme.helpers');
goog.require('plt.wescheme.tokenizer');

var WeSchemeEditor;

(function() {

    // The timeout between autosaving.
    var AUTOSAVE_TIMEOUT = 10000;
    // Number of failed save attempts
    var FAILED_SAVES = 0;
    // the timer to show the error message
    var delayedErrorTimer;

    //
    // These are the dependencies we're trying to maintain.
    //

    // isDirty: true if the file has been changed
    //          false when the file becomes saved.

    // saveButton: enabled only when the definitions area is dirty
    //             and the file hasn't been published
    //             and you own the file
    //             and you are logged in (non-"null" name)

    //
    // cloneButton: enabled when you are logged in (non-"null" name)
    //              and the file isn't dirty

    //
    // runButton: enabled all the time

    // the definitions and filename areas: readonly if you don't own the file,


    //////////////////////////////////////////////////////////////////////

    WeSchemeEditor = function(attrs, afterInit) {
		var that = this;

		this.userName = attrs.userName; // string
		this.actions = new plt.wescheme.AjaxActions();
	    this.onResize = undefined;
	    
		// defn is assumed to be Containers.
		// The only container we've got so far are TextContainers.
		this.defn = attrs.defn;  // TextAreaContainer

		// special screenreader features enabled? (default to false)
		this.screenreader = false;

		new plt.wescheme.WeSchemeInteractions(
	      attrs.interactions,
	      function(interactions) {
			  that.interactions = interactions;

			  that.interactions.setSourceHighlighter(function(id, offset, line, column, span, color) {
				  that.unhighlightAll();
				  return that.highlight(id, offset, line, column, span, color);
		      });

			  that.interactions.setAddToCurrentHighlighter(function(id, offset, line, column, span, color) {
				  return that.highlight(id, offset, line, column, span, color);
		      });

			  that.interactions.addOnReset(function() {that.defn.unhighlightAll()});
			  that.interactions.setMoveCursor(function(id, offset){that.moveCursor(id, offset)});
			  that.interactions.setScrollIntoView(function(id, offset, margin){that.scrollIntoView(id, offset, margin)});
			  that.interactions.setFocus(function(id){that.focus(id)});
			  that.interactions.addSetSelection(function(id, offset, line, column, span){
				  that.setSelection(id, offset, line, column, span);});

			  // pid: (or false number)
			  that.pid = false;


			  //////////////////////////////////////////////////////////////////////
			  // Flapjax stuff.

			  // The program title:
			  that.filenameElt = attrs.filenameInput.get(0);
			  // Any time the filenameEntry changes, adjust the
			  // document's title to match it, and mark content as dirty
			  that.filenameElt.onchange = function(e) {
			  	var v = that.filenameElt.value;
			  	document.title = (plt.wescheme.helpers.trimWhitespace(v) || "<< Unnamed Program >>");
				plt.wescheme.WeSchemeIntentBus.notify("filename-changed", that);
				myEditor.isDirty = true;
			  };

			  //////////////////////////////////////////////////////////////////////
			  // FLAGS
			  //////////////////////////////////////////////////////////////////////

			  that.saved 	= 	false;
			  that.loaded 	= 	false;
			  that.pid 		= 	false;
			  that.isNewFile= 	true;
			  that.isDirty 	= 	false;
			  that.isOwner 	= 	false;
			  that.isPublished= false;
			  that.isLoggedIn = that._getIsLoggedIn();
			  that.suppressWarningBeforeUnload = false;

			  if (afterInit) { afterInit(that); }
        });
		this.focusCarousel = [	document.getElementById('Tools'), 
								that.defn.div.getElementsByClassName("CodeMirror-scroll")[0], 
								that.interactions.prompt.div[0],
								document.getElementById('announcements')];
		setInterval(function(){
	    	console.log(
	    		'Considering autosave. Dirty is ', myEditor.isDirty, 
	    		'loaded is', myEditor.loaded,
	    		'saved is', myEditor.saved,
	    		'isPublished is', myEditor.isPublished,
	    		'isOwner is', myEditor.isOwner,
	    		'isLoggedIn is', myEditor.isLoggedIn);
	    	if(!myEditor.isDirty || 
	    		myEditor.isPublished || 
	    		!myEditor.isOwner ||
	    		!myEditor.loaded || 
	    		!myEditor.isLoggedIn) return;
	    	plt.wescheme.WeSchemeIntentBus.notify("autosave", this);
			that.save();
		  }, 10*1000);
    };

    WeSchemeEditor.prototype.setOnResize = function(onResize) {
        this.onResize = onResize;
    };

    // Force a refresh on the size of the editor.
    WeSchemeEditor.prototype.forceOnResize = function() {
        this.onResize();
    };

    // Allow multi-colored error highlighting to be disabled
    // experimentally.
    // Forward this call off to the interactions, which handles
    // evaluation and error handling.
    WeSchemeEditor.prototype.disableColoredErrorMessages = function() {
        this.interactions.disableColoredErrorMessages();
    };

    WeSchemeEditor.prototype.highlight = function(id, offset, line, column, span, color) {
    	if(id === '<no-location>'){
	    //do nothing
    	} else if (id === '<definitions>') {
		    return this.defn.highlight(id, offset, line, column, span, color);
		} else if (this.interactions.previousInteractionsTextContainers[id]) {
		    return this.interactions.previousInteractionsTextContainers[id].highlight(id, offset, line, column, span, color);
		}
    };

    WeSchemeEditor.prototype.setSelection = function(id, offset, line, column, span, color) {
    	if (id === '<definitions>') {
		    this.defn.setSelection(id, offset, line, column, span);
		} else if (this.interactions.previousInteractionsTextContainers[id]) {
		    this.interactions.previousInteractionsTextContainers[id].setSelection(id, offset, line, column, span);
		}
    };

    WeSchemeEditor.prototype.unhighlightAll = function() {
    	var key;
		for(key in this.interactions.previousInteractionsTextContainers) {
		    if (this.interactions.previousInteractionsTextContainers.hasOwnProperty(key)) {
			this.interactions.previousInteractionsTextContainers[key].unhighlightAll();
		    }
		}
		this.defn.unhighlightAll();
    };

    WeSchemeEditor.prototype.moveCursor = function(id, offset) {
    	if (id === '<definitions>') {
	    	this.defn.moveCursor(offset);
		} else if (this.interactions.previousInteractionsTextContainers[id]) {
		    this.interactions.previousInteractionsTextContainers[id].moveCursor(offset);
		}
    };

    WeSchemeEditor.prototype.scrollIntoView = function(id, offset, margin) {
    	if (id === '<definitions>') {
	    	this.defn.scrollIntoView(offset, margin);
		} else if (this.interactions.previousInteractionsTextContainers[id]) {
		    this.interactions.previousInteractionsTextContainers[id].scrollIntoView(offset, margin);
		}
    };

    WeSchemeEditor.prototype.focus = function(id) {
		if (id === '<definitions>') {
		    this.defn.focus();
		} else if (this.interactions.previousInteractionsTextContainers[id]) {
		    this.interactions.previousInteractionsTextContainers[id].focus();
		}
    };

    // WeSchemeEditor._getIsLoggedIn: -> boolean
    // Returns true if the user has been logged in.
    WeSchemeEditor.prototype._getIsLoggedIn = function() {
		return (this.userName && this.userName != 'null');
    };

    WeSchemeEditor.prototype.save = function(success, fail, cancel) {
      var that = this;
 
      var resetSaveDelay = function(){
        FAILED_SAVES = 0;   // set the tracker back to 0
        clearTimeout(delayedErrorTimer);// clear any pending error messages
      }
 
      var afterSave = function(pid) {
        that.pid = pid;
		that.saved = true;
		that.isDirty = false;
        resetSaveDelay(); // success! let's reset the decay
        plt.wescheme.WeSchemeIntentBus.notify("after-save", that);
        if (success) { success(); }
      }
      var whenSaveBreaks = function() {
        FAILED_SAVES = Math.min(FAILED_SAVES+1, 8);
        delayedErrorTimer = setTimeout(function(){
                                       alert("Unable to save!\n\nYou may have been logged out of Google Services."
                                             +"\nRefresh the Program List to log back in.");
                                       }, Math.pow(2, FAILED_SAVES) * 1000);
        if (fail) { fail(); }
      };

      var onFirstSave = function() {
        that.actions.save({ pid: false,
                            title: that.filenameElt.value,
                            code : that.defn.getCode()},
                          doPageReload,
                          whenSaveBreaks);
      };

      var onUpdate = function() {
        that.actions.save({ pid: that.pid,
                            title: that.filenameElt.value,
                            code : that.defn.getCode()},
                          afterSave,
                          whenSaveBreaks);
      };

      var afterFileNameChosen = function() {
        plt.wescheme.WeSchemeIntentBus.notify("before-save", that);
        if (that.pid == false) {
          onFirstSave();
        } else {
          if (that.isPublished) {
            that.actions.makeAClone(that.pid, that.defn.getCode(),
                                    function(newPid) {
                                      that.actions.save({ pid: newPid,
                                                          title: that.filenameElt.value,
                                                          code : that.defn.getCode()},
                                                        function() {
                                                          afterSave(newPid);
                                                          doPageReload(newPid);
                                                        },
                                                        whenSaveBreaks);
                                    },
                                    whenSaveBreaks);
          } else {
            onUpdate();
          }
        }
      };

      var doPageReload = function(pid) {
            that.suppressWarningBeforeUnload = true;
            plt.wescheme.WeSchemeIntentBus.notify("before-editor-reload-on-save", that)
        window.location = "/openEditor?pid=" + encodeURIComponent(pid);
        };


      that.filenameElt.value = plt.wescheme.helpers.trimWhitespace(that.filenameElt.value);
      that._enforceNonemptyName(afterFileNameChosen,
                                function() {
                                  // on abort, don't do anything.
                                  if (cancel) { cancel(); }
                                },
                                true);
      };

    WeSchemeEditor.prototype._enforceNonemptyName = function(afterK, abortK, isFirstEntry) {
		var that = this;
		var title = plt.wescheme.helpers.trimWhitespace(that.filenameElt.value);
		if (title === "") {
		    var dialogWindow = (jQuery("<div/>"));
	        var buttonPressed = false;

		    var onSaveButton = function() {
				buttonPressed = true;
				dialogWindow.dialog("close");
				that.filenameElt.value = plt.wescheme.helpers.trimWhitespace(inputField.attr("value"));
				that._enforceNonemptyName(afterK, abortK, false);
		    };

		    var onCancelButton = function() {
                buttonPressed = true;
				dialogWindow.dialog("close");
				abortK();
		    };

		    var inputField = jQuery("<input type='text' style='border: solid'/>");
		    dialogWindow.append(jQuery("<p/>").text("Please provide a name for your program: "));
		    dialogWindow.append(jQuery("<p/>").text("(The name cannot be left blank.)"));
		    dialogWindow.append(inputField);

		    dialogWindow.dialog({title: 'Saving your program',
				bgiframe : 	true,
				modal : 	true,
				overlay : 	{opacity: 0.5, background: 'black'},
				buttons : 	{ "Save" : onSaveButton, "Don't Save" : onCancelButton }
			});

	        dialogWindow.bind("dialogclose",
	                          function(event, ui) {
	                              if (! buttonPressed) { abortK(); }
	                          });


		    // Really stupid hacky code.  I have no idea how to
		    // cleanly grab at the buttons in a dialog constructed by
		    // jQuery-UI, so the following code does it by manually
		    // walking the dom tree.
		    var saveButton;
		    dialogWindow.dialog("widget").parent().find(":button")
				.each(function(index) {
					if (jQuery(this).text() === "Save") {
					    saveButton = this;
					}
			    });
		    var maintainSaveButtonStatus = function() {
			// Disable the save button if its content doesn't validate.
			setTimeout(
				   function() {
				       var name =
				       plt.wescheme.helpers.trimWhitespace(inputField.val());
				       if (name === "") {
					   saveButton.disabled = true;
					   jQuery(saveButton).hide('fast');
				       } else {
					   saveButton.disabled = false;
					   jQuery(saveButton).show('fast');
				       }
				   },
				   0);
		    };
		    maintainSaveButtonStatus();
		    inputField.keydown(maintainSaveButtonStatus);
		    inputField.change(maintainSaveButtonStatus);
		} else {
		    afterK();
		}
    };

    WeSchemeEditor.prototype.load = function(attrs, onSuccess, onFail) {
		var that = this;

		var whenLoadSucceeds = function(aProgram) {
	 	    that.pid = aProgram.getId();
	 	    var publicUrl = getAbsoluteUrl(
						   "/openEditor?publicId=" +
						   encodeURIComponent(aProgram.getPublicId()));
	 	    that.filenameElt.value = aProgram.getTitle();
	 	    that.filenameElt.onchange();

	        if (attrs.pid) {
		        	that.defn.setCode(aProgram.getSourceCode());
	        } else {
	            if (attrs.publicId && aProgram.isSourcePublic()) {
		            that.defn.setCode(aProgram.getSourceCode());
	            } else {
		            that.defn.setCode(";;  << Source code has not been shared >>");
	            }
	        }

		    if (that.userName === aProgram.getOwner()) {
				that._setIsOwner(true);
		    } else {
				that._setIsOwner(false);
		    }
		    that.loaded = true;
		    that.isPublished = aProgram.isPublished();
		    plt.wescheme.WeSchemeIntentBus.notify("after-load", that);
		    if (onSuccess) { onSuccess(aProgram.getSourceCode()); }
		};

		var whenLoadFails = function() {
		    // FIXME
		    alert("The load failed.");
		    if (onFail) { onFail(); }
		};

		if (attrs.pid) {
		    plt.wescheme.WeSchemeIntentBus.notify("before-load", this);
		    that.actions.loadProject(attrs.pid,
					     undefined,
					     whenLoadSucceeds,
					     whenLoadFails);
		} else if (attrs.publicId) {
		    plt.wescheme.WeSchemeIntentBus.notify("before-load", this);
		    that.actions.loadProject(undefined,
					     attrs.publicId,
					     whenLoadSucceeds,
					     whenLoadFails);
		} else {
		    throw new Error("pid or publicId required");
		}
    };

    function getAbsoluteUrl(relativeUrl) {
		var anchor = document.createElement("a");
		anchor.href = relativeUrl;
		return anchor.href;
    }

    WeSchemeEditor.prototype.share = function() {
		var dialog = new plt.wescheme.SharingDialog(this.pid, this.defn.getCode());
		dialog.show();
    };


    WeSchemeEditor.prototype.showNotesDialog = function() {
        var dialog = new plt.wescheme.NotesDialog(this.pid);
        var onSuccess = function() {};
        var onFail = function() {};
        dialog.show(onSuccess, onFail);
    };

    WeSchemeEditor.prototype.toggleHelp = function() {
		var help = document.getElementById("helpDialog");
    	function showHelp(){
    		help.style.top = "25%";
			help.focus();
			document.getElementById('editor').setAttribute('aria-activedescendant', help.id);
    	}
    	function hideHelp(e){
    		help.style.top = "100%";
    		help.blur();
    	}
		if(help.style.top == "25%") {
			hideHelp();
		} else { 
			showHelp();
		}
		help.onclick = hideHelp;
    }
    
    // Shows an Image Picker enabling choosing an image from Google Drive to the 
    // Definitions console. The image chosen will be translated into a function
    // call in the form (bitmap/url <image_url>).
    WeSchemeEditor.prototype.showPicker = function(defnInFocus) {

      // Create and render a Picker object for searching images.
      var APP_ID = plt.config.APP_ID;
      var oauthToken;

      var editor = defnInFocus ? this.defn : this.interactions.prompt.textContainer;
      var data;

      // Get the OAuth token for authenticating the picker
      function authenticatePicker() {
        var SCOPES = [
                  'https://www.googleapis.com/auth/drive.file',
                  'https://www.googleapis.com/auth/drive'
                  ];
        gapi.auth.authorize({
          'client_id': plt.config.CLIENT_ID,
          'scope': SCOPES.join(' '),
          'immediate': false
        }, function(authResult) {
          if (authResult && !authResult.error) {
            oauthToken = authResult.access_token;
            createPicker();
          }
          else {
            alert("There was an error authenticating.  Please make sure you're still logged in to Google.");
          }
        });
      }

      // Create the picker window itself and display it.
      function createPicker() {
          var view = new google.picker.View(google.picker.ViewId.DOCS);
          view.setMimeTypes("image/png,image/jpeg,image/jpg,image/gif");
          var picker = new google.picker.PickerBuilder()
        .setAppId(APP_ID)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setCallback(pickerCallback)
        .setOAuthToken(oauthToken)
        .build();
          picker.setVisible(true);
      }

	      
      // A simple callback implementation.
      function pickerCallback(data) {
          if (data.action == google.picker.Action.PICKED) {
            var doc = data[google.picker.Response.DOCUMENTS][0];
            var url = doc[google.picker.Document.URL];

            var permissions_body = {
              'role': 'reader',
              'type': 'anyone',
              'value': 'default',
              'withLink': true
            };
            gapi.client.load('drive', 'v2', setPermissionsAndInsertCode.bind(this, doc.id, permissions_body));
            // console.log(url);
          }
      }

      // Setting the image permissions for anyone having
      // the link.
      function setPermissionsAndInsertCode(fileId, body) {
          var request = gapi.client.drive.permissions.insert({
            'fileId': fileId,
            'resource': body
        });
           
        request.execute(function(resp) { });
         
        // Insert the generated code for producing the image in the 
        // definitions console.
        var code = editor.getCode();
        var curPos = editor.getCursorStartPosition();
        var preCursorCode = code.slice(0, curPos);
        var postCursorCode = code.slice(curPos, code.length);
        var pathToImg = "\"https://drive.google.com/uc?export=download&id=" + fileId + "\"";
        editor.setCode(preCursorCode + "(bitmap/url "+ pathToImg +")"+postCursorCode);
      }

      // Primary function call for creating picker
      if (oauthToken) { createPicker(); }
      else { authenticatePicker(); }
    }

    WeSchemeEditor.prototype.toggleScreenreader = function() {
    	this.screenreader = !this.screenreader;
    	this.interactions.say("screenreader features " + (this.screenreader? "on" : "off"), true);
    }
    WeSchemeEditor.prototype.getScreenreader = function() {
    	return this.screenreader;
    }
    
    WeSchemeEditor.prototype.cycleFocus = function(goBackwards) {
	    var nextFocusIndex, that = this, maxIndex = that.focusCarousel.length;
	    // find the currently focused ancestor
	    var currentFocusedElt = that.focusCarousel.find(function(node){
	    	return node.contains(document.activeElement);
	    });
	    // find the index of that element (-1 if nothing is selected)
	    var currentFocusIndex = that.focusCarousel.indexOf(currentFocusedElt);
      	nextFocusIndex = currentFocusIndex + (goBackwards? -1 : 1);
    	// see http://javascript.about.com/od/problemsolving/a/modulobug.htm
  	 	nextFocusIndex = ((nextFocusIndex % maxIndex) + maxIndex) % maxIndex;  
	    var focusElt = that.focusCarousel[nextFocusIndex];
    	document.activeElement.blur();
    	document.getElementById('editor').setAttribute('aria-activedescendant', focusElt.id);
    	focusElt.click();
    	focusElt.focus();
    };

    WeSchemeEditor.prototype.run = function(after) {
      var that = this;
      // if the isRunning flag is true, bail
      if(that.isRunning===true) return false;
      // otherwise, set it to true
      that.isRunning = true;
      plt.wescheme.WeSchemeIntentBus.notify("before-run", this);
      this.interactions.reset();
      this.interactions.runCode(this.defn.getCode(),
                                "<definitions>",
                                function() {
                                  // set isRunning to false
                                  that.isRunning = false;
                                  plt.wescheme.WeSchemeIntentBus.notify("after-run", that);
                                  if (after) { after(); }
                                });
    };

    WeSchemeEditor.prototype.getDefinitionsText = function() {
        return this.defn.getCode();
    };

    WeSchemeEditor.prototype.setDefinitionsText = function(v) {
        this.defn.setCode(v);
    };

    WeSchemeEditor.prototype.requestBreak = function() {
		this.interactions.requestBreak();
    };

    WeSchemeEditor.prototype._setIsOwner = function(v) {
		this.isOwner = v;
    };

    WeSchemeEditor.prototype.toString = function() { return "WeSchemeEditor()"; };

    // FIXME: copy and paste from console.js
    // makeShareUrl: string -> string
    // Produces the sharing url
    function makeShareUrl(publicId) {
      	// TODO: This does not always explicitly return a value.
		if (publicId != "") {
		    var a = document.createElement("a");
		    a.href = "/view?publicId=" + encodeURIComponent(publicId);
		    a.appendChild(document.createTextNode(a.href));
		    return jQuery(a);
		}
    }

    WeSchemeEditor.prototype.getTokenizer = function() {
        return plt.wescheme.tokenizer;
    };

})();

plt.wescheme.WeSchemeEditor = WeSchemeEditor;
