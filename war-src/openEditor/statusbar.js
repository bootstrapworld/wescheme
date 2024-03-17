// if (typeof (plt) === 'undefined') {
//     this.plt = {};
// }
// if (typeof (plt.wescheme) === 'undefined') {
//     this.plt.wescheme = {};
// }


goog.provide('plt.wescheme.WeSchemeStatusBar');


goog.require('plt.wescheme.WeSchemeIntentBus');



var WeSchemeStatusBar;

plt.wescheme.WeSchemeStatusBar = WeSchemeStatusBar = (function() {
    function WeSchemeStatusBar(statusbar) {
    this.statusbar = statusbar;
    this.announcements = document.getElementById("announcementlist");

    this.delay_till_fade = 5000; // five seconds until we fade the text.
    this.fadeCallbackId = undefined;

    var that = this;
    var handleNotifyIntent = function(action, category, data) {
	    var editorNotifyCategoryMap = {
        'before-save': 'Saving your program (please wait...)',
        'after-save': 'Your program has been saved',
        'before-clone': 'Saving a copy of this program to your account',
        'after-clone': 'You are now working on your own copy',
        'before-load': 'Loading your program (please wait...)',
        'after-load': 'Your program has been loaded',
        'before-publish': 'Publishing your program (please wait...)',
        'after-publish': 'Program has been published',
        'before-run': 'Running your program (please wait...)',
        'after-run': 'Finished running your program',
        'before-editor-reload-on-save': 'Please wait; saving program...'
      };
      // a list of all notifications for which we'd like to have the message wait before being cleared
      var waitingCategories = ['before-save', 'before-load', 'before-publish', 'before-run'];
      var waitForNextMessage = (waitingCategories.indexOf(category) >-1);
                                                      
	    if (action === 'notify' && editorNotifyCategoryMap[category]) {
          that.notify(editorNotifyCategoryMap[category], waitForNextMessage);
	    } else if (action === 'notify' && category === 'load-file') {
          that.notify("Waiting on \""+data+"\"");
	    } else if (action === 'notify' && category === 'exception') {
        var component = data[0];
        if (component instanceof WeSchemeEditor) {
            var operation = data[1];
            var statustext = data[2];
            var exceptionObj = data[3];
            that.notify("Exception occured in operation " + operation);
        }
      }
    };
    plt.wescheme.WeSchemeIntentBus.addNotifyListener(handleNotifyIntent);
  }


    var isBlinking = false;
    WeSchemeStatusBar.prototype.catchAttention = function(){
        if (isBlinking) { return; }
        var index = 0;
        var that = this;
        isBlinking = true;
        var oldOpacity = this.statusbar.css("opacity") || "0";

        var toggle = function() {
          that.statusbar.css('display', 'block');
          that.statusbar.css('opacity', '1');
          index++;
        }
        toggle();
        var intervalId =
        setInterval(function() {
                      toggle();
                      if (index > 1) {
                          // reset
                          that.statusbar.css('opacity', oldOpacity);
                          setTimeout(function(){that.statusbar.css('display', 'none');}, 500);
                          isBlinking = false;
                          clearInterval(intervalId); 
                      }
                    }, 1000);
    };


    WeSchemeStatusBar.prototype.notify = function(msg, waitForNextMessage) {
      var that = this;
      if(msg.indexOf("Waiting on") == -1) {
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(msg));
        that.announcements.appendChild(li);
      }
      var fadeOutFn = function() {
        that.statusbar.fadeOut("fast", function () { that.statusbar.text(""); });
      };
      
      if (this.fadeCallbackId) {
          clearTimeout(this.fadeCallbackId);
          this.fadeCallbackId = undefined;
      }

      if (msg) { this.catchAttention(); }
        
      this.statusbar.text(msg);
      this.statusbar.fadeIn("fast");
      
      if(!waitForNextMessage){
        this.fadeCallbackId = setTimeout(fadeOutFn, this.delay_till_fade);
      }
    };

    return WeSchemeStatusBar;
})();
