<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta name="viewport" content="width=device-width, user-scalable=no" />

    <title>WeScheme Editor</title>
    <!-- Tags for on mobile -->
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
    <link rel="apple-touch-icon-precomposed" href="/css/images/BigLogo.png" />


    <!-- Add compatibility libraries for IE. -->
    <jsp:include page="/js/compat/compat.jsp"/>

    <!-- Google analytics support -->
    <jsp:include page="/google-analytics.jsp"/>

    <!-- dynamic script loading -->
    <script src="/js/loadScript-min.js" type="text/javascript"></script>


    <!-- JQuery -->
    <script src="/js/jquery/jquery-1.3.2-min.js" type="text/javascript"></script>
    <script src="/js/jquery/jquery-ui-1.8.24.min.js" type="text/javascript"></script>

    <!-- Google JavaScript API -->
    <script src="https://apis.google.com/js/client.js?onload=handleClientLoad" type="text/javascript"></script>

  <!-- The standard Google Loader script; use your own key.
    <script src="https://www.google.com/jsapi?key=AIzaSyBV6MeANy_ZaLB2f2c-XKCMA7hIu2Fy744?onload=loadPicker"></script>
  -->

    <!-- Load the Google API. LoadPicker is defined in editor.js -->
    <script type="text/javascript" src="https://apis.google.com/js/api.js"></script>

    <!-- JQuery UI style sheet -->
    <link rel="stylesheet" type="text/css" href="/css/jquery-ui.css"/>


    <link rel="stylesheet" type="text/css" href="/css/common.css" />
    <link rel="stylesheet" type="text/css" href="/css/default.css" />
    <link rel="stylesheet" type="text/css" href="/css/pretty-printing.css" />

    <!-- EasyXDM and json -->
    <script src="/js/easyXDM/easyXDM-min.js" type="text/javascript"></script>
    <script type="text/javascript">
      easyXDM.DomHelper.requiresJSON("/js/easyXDM/json2-min.js");
    </script>


    <script src="/safeSubmit-min.js" type="text/javascript"></script>

    <script src="/js/flapjax-2.0.1.compressed-min.js" type="text/javascript"></script>
    <script src="/js/flapjax-helpers-min.js" type="text/javascript"></script>
    <script src="/js/jquery/jquery.createdomnodes-min.js" type="text/javascript"></script>
    <script src="/js/jquery/jquery.center-in-client-min.js" type="text/javascript"></script>
    <script src="/js/jquery/jquery.blockUI-min.js" type="text/javascript"></script>

    <script src="/js/codemirror/lib/codemirror-min.js" type="text/javascript"></script>
    <script src="/js/codemirror/addon/edit/matchbrackets.js" type="text/javascript"></script>
    <script src="/js/codemirror/addon/edit/closebrackets-min.js" type="text/javascript"></script>
    <script src="/js/codemirror/addon/runmode/runmode.js" type="text/javascript"></script>
    <script src="/js/codemirror-contrib/scheme2/scheme2-min.js" type="text/javascript"></script>

    <link rel="stylesheet" type="text/css" href="/css/codemirror.css" />
    <link rel="stylesheet" type="text/css" href="/js/codemirror/lib/codemirror.css"></link>
    <link rel="stylesheet" type="text/css" href="/js/codemirror-contrib/scheme2/schemecolors.css"></link>

    <link rel="stylesheet" type="text/css" href="/css/definitions.css"></link>

    <!-- Design recipe widget stuff -->
    <script src="/widget/js/DRwidget.js" type="text/javascript"></script>
    <link rel="stylesheet" type="text/css" href="/widget/css/editor.css"></link>


    <script src="/js/submitpost-min.js" type="text/javascript"></script>

    <!-- mzscheme-vm evaluator -->
    <script src="/js/mzscheme-vm/support-min.js" type="text/javascript"></script>
    <script src="/js/mzscheme-vm/evaluator-min.js" type="text/javascript"></script>


    <!-- Local compiler files -->
    <script src="/js/compiler/compiler-calc-min.js" type="text/javascript"></script>

    <script src="/js/openEditor/openEditor-calc-min.js" type="text/javascript"></script>


    <%
       org.wescheme.user.Session userSession =
       (new org.wescheme.user.SessionManager()).authenticate(request, response);

       boolean isEmbedded = false;
       %>


    <script type="text/javascript">
      function setup() {
          var userName, pid, publicId,
              hideHeader, hideToolbar,
              hideProjectName,
              hideFooter, hideDefinitions, hideInteractions,
              warnOnExit, interactionsText, definitionsText, autorunDefinitions, isEmbedded, noColorError;
          userName = pid = publicId = interactionsText = definitionsText = null;
          hideDefinitions = false;
          hideInteractions = false;
          autorunDefinitions = false;
          hideHeader = false;
          hideToolbar = false;
          hideProjectName = false;
          hideFooter = false;
          warnOnExit = true;
          isEmbedded = false;
          noColorError = false;

          userName = "<%= userSession != null? userSession.getName() : null %>";

          <% if (request.getParameter("hideHeader") != null &&
                 request.getParameter("hideHeader").equals("true")) { %>
	             hideHeader = true;
          <% } %>

          <% if (request.getParameter("hideToolbar") != null &&
                 request.getParameter("hideToolbar").equals("true")) { %>
	             hideToolbar = true;
          <% } %>

          <% if (request.getParameter("hideProjectName") != null &&
                 request.getParameter("hideProjectName").equals("true")) { %>
	             hideProjectName = true;
          <% } %>

          <% if (request.getParameter("hideFooter") != null &&
                 request.getParameter("hideFooter").equals("true")) { %>
	             hideFooter = true;
          <% } %>

          <% if (request.getParameter("hideDefinitions") != null &&
                 request.getParameter("hideDefinitions").equals("true")) { %>
	             hideDefinitions = true;
          <% } %>

          <% if (request.getParameter("hideInteractions") != null &&
                 request.getParameter("hideInteractions").equals("true")) { %>
	             hideInteractions = true;
          <% } %>

          <% if (request.getParameter("warnOnExit") != null &&
                 request.getParameter("warnOnExit").equals("false")) { %>
	             warnOnExit = false;
          <% } %>

          <% if (request.getParameter("autorun") != null &&
                 request.getParameter("autorun").equals("true")) { %>
	             autorunDefinitions = true;
          <% } %>

          <% if (request.getParameter("interactionsText") != null) { %>
	             interactionsText =
	               decodeURIComponent("<%= java.net.URLEncoder.encode(
					       request.getParameter("interactionsText"), "utf-8").replaceAll("\\+", "%20") %>");
          <% } %>

          <% if (request.getParameter("definitionsText") != null) { %>
	             definitionsText =
	               decodeURIComponent("<%= java.net.URLEncoder.encode(
					       request.getParameter("definitionsText"), "utf-8").replaceAll("\\+", "%20") %>");
          <% } %>


          <% if (request.getParameter("pid") != null) { %>
	             pid = decodeURIComponent('<%= java.net.URLEncoder.encode(request.getParameter("pid"), "utf-8") %>');
      	  <% } else if (request.getParameter("publicId") != null){ %>
         	      publicId = decodeURIComponent('<%= java.net.URLEncoder.encode(request.getParameter("publicId"), "utf-8") %>');
      	  <% } else { %>
      	  <% } %>


          <%
             if (request.getParameter("embedded") != null &&
                 request.getParameter("embedded").equals("true") &&
                 // embedded mode is not allowed when pid has been provided.
                 request.getParameter("pid") == null) {
	                 isEmbedded = true;
             }
          %>
          isEmbedded = <%= isEmbedded %>; // expose it on the JavaScript side too.


          <% if (request.getParameter("noc") != null) { %>
	             noColorError = true;
          <% } %>


              initializeEditor({userName: userName,
                            pid : pid,
                            publicId: publicId,
      	                    hideHeader: hideHeader,
      	                    hideToolbar: hideToolbar,
      	                    hideProjectName: hideProjectName,
      	                    hideFooter: hideFooter,
      	                    hideDefinitions: hideDefinitions,
      	                    hideInteractions: hideInteractions,
      	                    warnOnExit: warnOnExit,
      	                    initialInteractionsText: interactionsText,
      	                    initialDefinitionsText: definitionsText,
      	                    autorunDefinitions: autorunDefinitions,
                            noColorError: noColorError });

              var widget = initializeWidget(myEditor.defn.impl.editor,
                                        myEditor.getTokenizer());
              document.getElementById("recipe").addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                var codeUpToCursor = myEditor.defn.getCode(0, myEditor.defn.getCursorStartPosition());
                // don't let the user start the DR if the cursor is inside an expression
                if(plt.wescheme.tokenizer.hasCompleteExpression(codeUpToCursor)){
                  widget.showWidget();
                } else {
                  alert("You cannot start the Design Recipe widget when your cursor is inside another expression.");
                  myEditor.defn.focus();
                }
            });
        }

      jQuery(function() {
        var viewportWidth = jQuery(window).width();
        var viewportHeight = jQuery(window).height();
        var something = jQuery("#documentation").dialog({
          autoOpen: false,
          title: "Documentation",
          position: "right",
          minWidth: viewportWidth / 4,
          minHeight: viewportHeight / 2,
          width: viewportWidth / 3,
          height: viewportHeight * .9,
          beforeclose: function() {
            jQuery(this).dialog('option', 'position', [jQuery(this).parent().offset().left, jQuery(this).parent().offset().top]);
            }
        });
      });
    </script>
  </head>

  <body onload="setup()">
    <div id="editor">
      <div class="top" id="top">

      <!-- The dialog div here will be used by jquery -->
      <div id="dialog" style="display:none;"></div>

      <!-- The Design Recipe Widget -->
      <div id="design-recipe-form" style="position: absolute; left: -1000px; z-index: 10; visibility: hidden;">
        <div class="section" id="design-recipe-contract">
                <div id="design-recipe-contract_wrapper">
                  <span class="spacer" style="width: 15px;">;</span>
                  <textarea id="design-recipe-name"></textarea>
                  <span>:</span>
                  <textarea id="design-recipe-domain"></textarea>
                  <span>-></span>
                  <textarea id="design-recipe-range"></textarea>
                </div>
                <span class="error" id="design-recipe-contract_error"></span>
        </div>
        <div class="section" id="design-recipe-examples">
          <div id="design-recipe-example1_wrapper">
            <span class="spacer notranslate">(EXAMPLE </span>
            <div class="indent-wrapper">
              <textarea id="design-recipe-example1_header"></textarea>
              <textarea id="design-recipe-example1_body"></textarea>
              <span class="spacer">)</span>
            </div>
          </div>
          <span class="error" id="design-recipe-example1_error"></span>
          <hr/>
          <div id="design-recipe-example2_wrapper">
            <span class="spacer notranslate">(EXAMPLE </span>
            <div class="indent-wrapper">
               <textarea id="design-recipe-example2_header"></textarea>
             <textarea id="design-recipe-example2_body"></textarea>
             <span class="spacer">)</span>
            </div>
          </div>
          <span class="error" id="design-recipe-example2_error"></span>
        </div>
        <div class="section" id="design-recipe-definition">
          <div id="design-recipe-definition_wrapper">
            <span class="spacer notranslate">(define </span>
            <div class="indent-wrapper">
              <textarea id="design-recipe-definition_header"></textarea>
              <textarea id="design-recipe-definition_body"></textarea>
              <span class="spacer">)</span>
            </div>
          </div>
          <span class="error" id="design-recipe-definition_error"></span>
        </div>

        <div class="toolbar">
                <input type="button"
                       id="design-recipe-insertCode"
                       class="button"
                       value="Insert"
                       style="float: right; color: black;"/>
          <input type="button" id="design-recipe-cancel" class="button" value="Cancel" style="float: left;" />
        </div>
      </div>

      <!-- Header at the top of the page -->
      <div id="Tools" role="region" aria-label="Tools" tabindex="-1">
      	<div id="Navigation">
          <h2 class="screenreader-only">Navigation</h2>
          <ul style="margin: 0px; padding: 0px;">
            <li><a  class="h1" href="/" title="WeScheme Homepage"
                role="button" aria-label="Back to WeScheme Homepage"
                style="text-decoration: none; color: white;">WeScheme :: </a></li>
            <li><a  class="h2" href="doc/wescheme.html"
                role="button" aria-label="Show Documentation" 
                id="docs" target="_docs">Documentation</a></li>
      	    <% if (userSession != null) { %>
                  <li><a  class="h2" role="button"  id="account" 
                      href="/console" target="console"
                      aria-label="Go to program list">Programs</a></li>
                  <li><a  class="h2" role="button"  id="logout" href="javascript: void(0)"
                      aria-label="Log out of WeScheme and other Google services">Logout</a></li>
      	    <% } %>
            </ul>
      	</div>

      	<div id="ProgramControls">
          <h2 class="screenreader-only">Program Controls</h2>
      	  <ul>
      	    <li><a role="button" href="javascript: void(0)" aria-label="Run, F7"  id="run"><span>Run</span></a></li>
      	    <li><a role="button" href="javascript: void(0)" aria-label="Stop, F8" id="stop"><span>Stop</span></a></li>
      	    <% if (userSession != null) { %>
      	    <li><a role="button" href="javascript: void(0)" aria-label="Save" id="save"><span>
              <% if (request.getParameter("publicId") != null){ %>
                    Remix
              <% } else { %>
                    Save
              <% } %>
            </span></a></li>
      	    <li><a role="button" href="javascript: void(0)" aria-label="Share, F9" id="share"><span>Share</span></a></li>
            <li><a role="button" href="javascript: void(0)" aria-label="Images" id="images"><span>Images</span></a></li>
      	    <% } %>
            <li><a role="button" href="javascript: void(0)" aria-label="Open a Design Recipe Form" id="recipe"><span>Recipe</span></a></li>
      	  </ul>
      	</div>

      	<div id="FileControls">
          <h2 class="screenreader-only">File Controls</h2>
       	  <label id="filenamelabel" for="filename">Project name:</label>
      	  <input role="textbox" id="filename" type="text" aria-describedby="filenamelabel" style="width: 20%"/>
          <a role="button" href="javascript: void(0)" aria-label="Open Program Notes" id="updateNotes" class="clickableAnchor">
            <img src="/images/small-info.png"></a>
          <a role="button" href="javascript: void(0)" aria-label="Undo" id="undo" class="clickableAnchor"><img src="/images/undo.png"></a>
          <a role="button" href="javascript: void(0)" aria-label="Redo" id="redo" class="clickableAnchor"><img src="/images/redo.png"></a>
          <a role="button" href="javascript: void(0)" aria-label="Help" id="help" class="clickableAnchor" style="float: right;">
            <img src="/images/small-help.png"></a>
          <div id="statusbar" role="marquee" aria-relevant="text"></div>
      	</div>
      </div> 

      </div>
      <!--  End top -->

      <div id="middle" class="middle notranslate">
      	<div id="splitpane" class="goog-splitpane">
          <div  id="definitions" tabindex="-1" 
                class="goog-splitpane-first-container" 
                role="region" aria-label="Definitions">
            <h2 class="screenreader-only">Definitions</h2>
            <textarea id="defn"></textarea>
      	  </div>

      	  <div id="interactions" class="goog-splitpane-second-container">
      	    <div  id="inter" tabindex="-1" 
                  role="application" 
                  aria-label="Interactions">
              <h2 class="screenreader-only">Interactions</h2>
      	      <div style="width: 100%; height:100%">
                <span>&gt;&nbsp<input id="inputBox" style="width: 75%;height:100%" type="text"/></span>
              </div>
      	    </div>
      	  </div>

      	  <div class="goog-splitpane-handle" aria-role="separator" aria-orientation="vertical" aria-label="divider"></div>
      	</div>
      </div>
      <!-- End middle -->

      <div id="bottom" class="bottom">
        <!-- all spoken events should be logged here -->
        <div id="announcements" role="region" aria-label="Announcements" tabindex="-1" 
             class="screenreader-only" >
          <h2>Announcements</h2>
          <ul id="announcementlist" aria-live="assertive" aria-relevant="additions"
              style="list-style: none;">
          </ul>
        </div>
      </div>
      <!-- end bottom -->

    </div> <!-- end editor -->

    <div id="helpDialog" tabindex="-1">
      <h1>WeScheme Help</h1>
      <p>
      Welcome to WeScheme! This help window can be turned on and off by clicking the <img alt="help" src="/images/small-help.png"> icon in the toolbar, or by typing <kbd aria-label="Control question mark">Ctrl-?</kbd> (or <kbd aria-label="Command question mark">Cmd-?</kbd> on a mac). You can also hide this window by clicking on it.
      <p>
      <p>
      <div class="shortcutGroup" tabindex="-1">
        <h2>Everywhere</h2>
        <ul class="shortcuts">
          <li>Run - <kbd>F7</kbd></li>
          <li>Stop - <kbd>F8</kbd></li>
          <li>Share - <kbd>F9</kbd></li>
          <li>Help - <kbd aria-label="Control question mark">Ctr-?</kbd></li>
          <li>Switch Focus - <kbd>F6</kbd></li>
        </ul>
      </div>

      <div class="shortcutGroup" tabindex="-1">
        <h2>Definitions Only</h2>
        <ul class="shortcuts">
          <li>Indent Line - <kbd>Tab</kbd></li>
          <li>Indent All - <kbd aria-label="Control Tab">Ctrl-Tab</kbd></li>
        </ul>
      </div>

      <div class="shortcutGroup" tabindex="-1">
        <h2>Interactions Only</h2>
        <ul class="shortcuts">
          <li>Previous Entry - <kbd>Alt-Up</kbd></li>
          <li>Next Entry - <kbd>Alt-Down</kbd></li>
          <li>Speak History - <kbd>Alt-1</kbd>, <kbd>Alt-2</kbd>, etc</li>
        </ul>
      </div>
    </div>

    <!-- invisible form for error logging from the local processor -->
    <iframe name="hidden_iframe" id="hidden_iframe" style="display:none;"></iframe>
    <form method="post"
          action="https://docs.google.com/a/bootstrapworld.org/forms/d/1qd7swEkFgVBsudpAFsEJnrjDDCQOMPTICQ2NgraVrOw/formResponse"
          name="theForm" 
          id="errorLogForm" 
          target="hidden_iframe" 
          id="GoogleForm"
          style="display:none;">
          <textarea name="entry.1936827156" id="expr"/>default_code</textarea>
          <textarea name="entry.1976503423" id="local">default_localError</textarea>
          <textarea name="entry.224419714" id="server">default_serverError</textarea>
          <textarea name="entry.234335861" id="diffString"></textarea>
          <input type="button" value="Submit" class="submit"/>
    </form>
  </body>




  <script type="text/javascript">
    <% if (isEmbedded) { %>
    // If we're in embedded mode, start up a socket for cross domain messaging support.
    var rpc = new easyXDM.Rpc({ local: "/js/easyXDM/name.html",
                                swf: "/js/easyXDM/easyxdm.swf",
                              },
                              { local : { run : function(onSuccess) {
                                                    myEditor.run(onSuccess);
                                                },
                                          requestBreak : function(onSuccess) {
                                                    myEditor.requestBreak();
                                                    onSuccess();
                                                },
                                          getDefinitionsText : function(onSuccess) {
                                                   onSuccess(myEditor.getDefinitionsText());
                                                },
                                          setDefinitionsText : function(v, onSuccess) {
                                                   myEditor.setDefinitionsText(v);
                                                   onSuccess();
                                                }
                                              }
                                });
   <% } %>
  </script>


</html>
