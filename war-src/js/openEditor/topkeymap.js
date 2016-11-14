goog.provide('plt.wescheme.topKeymap');
goog.require('plt.wescheme.BrowserDetect');


//FIXME: depends on global variable myEditor at toplevel.


var F5_KEYCODE = 116
var F6_KEYCODE = 117
var BACKSPACE_KEYCODE = 8;
var SAVE_KEYCODE = 83;
var ZOOMIN_KEYCODE = 187;
var ZOOMOUT_KEYCODE = 189;
var DIM_KEYCODE = 113;
var BRIGHTEN_KEYCODE = 114;


// Global state: checks to see whether or not we're in the middle of a
// save or not.
var inMiddleOfSave = false;

function cancelEvent(e) {
  e.cancelBubble = true;
  if (e.stopPropagation) { e.stopPropagation(); }
  e.returnValue = false;
  if (e.preventDefault) { e.preventDefault(); }
  if (! e.preventDefault) {
      // IE-specific hack.
      e.keyCode = 0;
  }
}


//The following is a global keyhandler that's intended to be attached
//to the document body, so it should see all key events.
plt.wescheme.topKeymap = function(e) {
    if (e.keyCode === SAVE_KEYCODE &&
        (plt.wescheme.BrowserDetect.OS==="Mac" ? e.metaKey : e.ctrlKey)) {

        if (! inMiddleOfSave) {
            inMiddleOfSave = true;
            myEditor.save(
                      function() { 
                          // successful save
                          inMiddleOfSave = false; 
                      },
                      function() {
                          // failed save
                          inMiddleOfSave = false; 
                      },
                      function() { 
                          // cancelled save
                          inMiddleOfSave = false; 
                      });        
          }
          cancelEvent(e);
          return false;
    }

    if (e.keyCode === F5_KEYCODE) {
      myEditor.run();
      cancelEvent(e);
      return false;
    }

    if (e.keyCode === F6_KEYCODE) {
      myEditor.cycleFocus(e.shiftKey);
      cancelEvent(e);
      return false;
    }

    if (e.keyCode === DIM_KEYCODE ||
        e.keyCode === BRIGHTEN_KEYCODE) {
      e.codemirrorIgnore = true;
      return false;
    }
  
    if (e.keyCode === ZOOMIN_KEYCODE &&
        (plt.wescheme.BrowserDetect.OS==="Mac" ? e.metaKey : e.ctrlKey)) {
      var size = parseInt(document.getElementById('middle').style.fontSize) || 10;
      document.getElementById('middle').style.fontSize=(size+1)+'pt';
      var cms = document.getElementsByClassName('CodeMirror');
      for(var i=0; i<cms.length; i++){ cms[i].CodeMirror.refresh(); }
      return false;
    }
    if (e.keyCode === ZOOMOUT_KEYCODE &&
        (plt.wescheme.BrowserDetect.OS==="Mac" ? e.metaKey : e.ctrlKey)) {
      var size = parseInt(document.getElementById('middle').style.fontSize) || 10;
      document.getElementById('middle').style.fontSize=(size-1)+'pt';
      var cms = document.getElementsByClassName('CodeMirror');
      for(var i=0; i<cms.length; i++){ cms[i].CodeMirror.refresh(); }
      return false;
    }

    // Special case: we want to intercept all backspaces that hit the
    // document body, and prevent us from going back in history.
    if (e.target === document.body) {
      if (e.keyCode === BACKSPACE_KEYCODE) {
          cancelEvent(e);
          return false;
      }
      return true;
    }
}

