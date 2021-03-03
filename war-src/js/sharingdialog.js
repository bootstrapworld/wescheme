goog.provide("plt.wescheme.SharingDialog");

goog.require("goog.dom");
goog.require('goog.ui.AdvancedTooltip');

goog.require("plt.wescheme.AjaxActions");
goog.require("plt.wescheme.helpers");
goog.require("plt.wescheme.WeSchemeIntentBus");


// if (typeof (plt) === 'undefined') {
//     this.plt = {};
// }
// if (typeof (plt.wescheme) === 'undefined') {
//     this.plt.wescheme = {};
// }
//plt.wescheme.SharingDialog = {};



(function() {
    // constructor: id (string | null) -> SharingDialog
    plt.wescheme.SharingDialog = function(pid, code) {
        this.pid = pid;
        this.code = code;
        this.actions = new plt.wescheme.AjaxActions();
    };

    plt.wescheme.SharingDialog.prototype.show = function(onShareSuccess, onAbort) {
        var that = this;
        var dialogWindow = (jQuery("<div/>"));
        
        var shareWithSource = function() {
            dialogWindow.dialog("close");
            doTheSharing(true);
        };

        var shareWithoutSource = function() {
            dialogWindow.dialog("close");
            doTheSharing(false);
        };

        var handleClose = function() {
          // unblock screen-readers
          document.getElementById('editor').removeAttribute('aria-hidden');
        };

        // Does the brunt work of the sharing.
        // If sharing is completely successful, onSuccess will be called.
        // If at any point, something breaks, onFailure will be called.
        var doTheSharing = function(isPublic) {
            plt.wescheme.WeSchemeIntentBus.notify("before-publish", that);
            
            that.actions.makeAClone(
                that.pid, 
                that.code,
                function(newPid) { showResultOfSharing(isPublic, newPid, false); },
                whenCloningFails);
        };

        var showResultOfSharing = function(isPublic, newPid, errMessage) {

            function copyShareLink() {
              var copyText = document.getElementById("sharedLink");
              copyText.select();
              copyText.setSelectionRange(0, 99999); /*For mobile devices*/
              document.execCommand("copy");
            }
            that.actions.share(newPid, isPublic,
                               function(sharedProgram) {
                                   var newDialog = jQuery("<div/>");
                                   // block screen-readers
                                   document.getElementById('editor').setAttribute('aria-hidden', true);
                                   newDialog.dialog(
                                       {title: 'Sharing your program',
                                        bgiframe : true,
                                        modal : true,
                                        beforeClose: handleClose,
                                        width: 600,
                                        close : function() {
                                            if (onShareSuccess) {onShareSuccess(sharedProgram);}
                                        }
                                       });
                                   plt.wescheme.WeSchemeIntentBus.notify("after-publish", that);
                                   
                                   newDialog.append(jQuery("<p/>").text("Program has been shared: "));
                                   var publicId = sharedProgram.find("publicId").text();
                                   url = plt.wescheme.helpers.makeShareUrl(publicId);
                                   inpt = document.createElement("input");
                                   inpt.id = "sharedLink";
                                   inpt.style="width: 515px; padding: 0px 4px; line-height: 25px;";
                                   inpt.value = url;
                                   inpt.readOnly = true;
                                   newDialog.append(inpt);
                                   anchor = plt.wescheme.helpers.urlToAnchor(url),
                                   title = sharedProgram.find("title").text();
                                   copyBtn = document.createElement("button");
                                   copyBtn.onclick=copyShareLink;
                                   copyBtn.innerHTML = "&#10697;";
                                   newDialog.append(copyBtn);
                                   newDialog.append(jQuery("<p/>"));
                                   newDialog.append(jQuery(plt.wescheme.helpers.generateSocialBookmarks(title, anchor.href)));

                                   // Quietly ignore errMessage.
                                   // We'll deal with it during Run time.
                                   //
                                   // // Add error message content if something weird happened during the build.
                                   // if (errMessage !== false) {
                                   //     newDialog.append(
                                   //         jQuery("<p/>").text("However, the program won't be able to run because of the following: "));
                                   //     newDialog.append(jQuery("<tt/>").css("color", "red").text(errMessage));
                                   //     if (isPublic) {
                                   //         newDialog.append(
                                   //             jQuery("<p/>")
                                   //                 .text("Although it won't run, its source can still be viewed."));
                                   //     }
                                   // }

                                   newDialog.dialog("open");
                               },
                               whenSharingFails);
        };

        var whenCloningFails = function() {
            // FIXME
            alert("cloning failed");
            if (onAbort) { onAbort(); }
        };

        var whenSharingFails = function() {
            // FIXME
            alert("Sharing failed.");
            if (onAbort) { onAbort(); }
        };

        // block screen-readers
        document.getElementById('editor').setAttribute('aria-hidden', true);
        if (this.pid) {
            dialogWindow.append(jQuery("<p/>").text("Publishing will let your friends run this program. Would you like them to be able to see your code, too?"));
            dialogWindow.dialog({title: 'Publish My Program',
                                 bgiframe : true,
                                 modal : true,
                                 beforeClose: handleClose,
                                 overlay : {opacity: 0.5, background: 'black'},
                                 buttons : { "Yes" : shareWithSource,
                                             "No" : shareWithoutSource }
                                });
            dialogWindow.dialog("open");
        } else {
            dialogWindow.append(jQuery("<p/>").text("The program needs to be saved before it can be shared."));
            dialogWindow.dialog({title: 'Sharing your program',
                                 bgiframe : true,
                                 modal : true,
                                 beforeClose: handleClose,
                                 overlay : {opacity: 0.5, background: 'black'},
                                 buttons : {}
                                });
            dialogWindow.dialog("open");
        }
    };


    //////////////////////////////////////////////////////////////////////

    // makeShareButton: (Program | ProgramDigest) (-> void) (-> void) -> void
    // Creates a share button, given a Program or a ProgramDigest.
    // Either must have the following methods:
    // p.getId()
    // p.hasSharingUrls()
    // p.getSharedAsEntries()
    plt.wescheme.SharingDialog.makeShareButton = function(aProgramOrDigest,
							  onSuccess,
							  onFailure) {
        var img = (aProgramOrDigest.hasSharingUrls() ?
                   jQuery("<img class='button' src='/css/images/share.png'/>") :
                   jQuery("<img class='button' src='/css/images/share-decolored.png'/>"));
        img.click(function() {
            (new plt.wescheme.SharingDialog(aProgramOrDigest.getId(), null)).show(onSuccess, onFailure);
        });
        var shareSpan =(jQuery("<span/>").addClass("ProgramPublished").append(img));

        attachSharingPopupTooltip(shareSpan.get(0), aProgramOrDigest);
        return shareSpan;
    };


    // attachSharingPopupTooltip: dom program-or-digest -> void
    var attachSharingPopupTooltip = function(parent, aProgramOrDigest) {
        var tooltip = new goog.ui.AdvancedTooltip(parent);
        tooltip.className = 'tooltip';
        if (aProgramOrDigest.hasSharingUrls()) {
            tooltip.setHtml("<h2>Program sharing</h2>" + "This program has been shared.", true);
            var aList = goog.dom.createElement("ul");
            var entries = aProgramOrDigest.getSharedAsEntries();
            // We'll just look at the first one.
            var elt = entries[0];
            var item = goog.dom.createElement("li");
            aList.appendChild(item);
            var title = elt.title;
            var anchor = makeShareAnchor(elt.publicId, elt.title);
            item.appendChild(anchor);
            item.appendChild(goog.dom.createTextNode(" [" + plt.wescheme.helpers.prettyPrintDate(elt.modified) + "]"));
            item.appendChild(plt.wescheme.helpers.generateSocialBookmarks(title, anchor.href));
            goog.dom.appendChild(tooltip.getElement(), aList);

        } else {
            tooltip.setHtml("<h2>Program sharing</h2>" +
                            "This program has not been shared yet.  Click the share icon to share it.", true);
        }
        tooltip.setHotSpotPadding(new goog.math.Box(5, 5, 5, 5));
        tooltip.setCursorTracking(true);
        tooltip.setHideDelayMs(250);
    }


    // makeShareUrl: string -> element
    // Produces the sharing url
    var makeShareAnchor = function(publicId, name) {
        if (publicId != "") {
            var a = document.createElement("a");
            a.href = plt.wescheme.helpers.makeShareUrl(publicId);
            a.target = "_blank";
            a.appendChild(document.createTextNode(name || a.href));
            return a;
        } else {
            throw new Error();
        }
    }

    //////////////////////////////////////////////////////////////////////
})();
