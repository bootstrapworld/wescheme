<%@ page import="org.wescheme.user.SessionManager" %>
<%@ page import="org.wescheme.user.Session" %>
<%@ page import="java.net.URLEncoder" %>
<%@ page import="com.google.appengine.api.users.UserServiceFactory" %>
<%@ page import="com.google.appengine.api.users.UserService" %>
<% 
   // The Console page requires a login: if you come in without the right
   // credentials, let's bump them to the login page.
   SessionManager sm = new SessionManager(); 
   Session s = sm.authenticate(request, response);
   if( s == null ) {
       UserService us = UserServiceFactory.getUserService();
       // Not logged in: we should send them off to the login page.
       response.sendRedirect(us.createLoginURL("/login.jsp"));
   } else {
%>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>

<link rel="stylesheet" type="text/css" href="/css/common.css" />
<link rel="stylesheet" type="text/css" href="/css/console.css" />
<title>WeScheme</title>

<!-- Refresh the page every 10min to preserve login credentials -->
<meta http-equiv="refresh" content="600">


<!-- Google analytics support -->
<jsp:include page="/google-analytics.jsp"/>


<jsp:include page="/js/compat/compat.jsp"/>


<!-- JQuery -->
<script src="/js/jquery/jquery-1.3.2-min.js" type="text/javascript"></script>
<script src="/js/jquery/jquery-ui-1.7.3.custom.min.js" type="text/javascript"></script>


<!-- JQuery UI style sheet -->
<link rel="stylesheet" type="text/css" href="/css/jquery-ui.css"/>


<script src="editor/jquery.createdomnodes-min.js" type="text/javascript"></script>
<script src="safeSubmit-min.js" type="text/javascript"></script>
<script src="/js/submitpost-min.js" type="text/javascript"></script>



<script src="/js/console-calc-min.js" type="text/javascript"></script>


</head>
<body>


<div id="editor">
<div class="header" style="position: fixed;">
    <span class="title h1">My Programs</span><br/>
    <span class="h2">Welcome, <%= s.getNickname() %></span>
</div>



<div id="toolbar">
  <h2 class="screenreader-only">Navigation</h2>
	<ul>
		<li id="start">
		  <a href="/openEditor" target="_blank">
		    Start a new program
		  </a>
		</li>
    <li id="bootstrapFiles">
      <span class="menu" onclick="this.classList.toggle('hovered')">
        Bootstrap Starter Files &#9660;
      </span>
      <ul id="bootstrapFileList">
        <li><a target="_blank" href="http://goo.gl/mxC2Vx">NinjaCat</a></li>
        <li><a target="_blank" href="http://goo.gl/TwwrZ4">Defining Values</a></li>
        <li><a target="_blank" href="https://www.wescheme.org/openEditor?publicId=ysj93ZPFsu">Game Template</a></li>
        <li><a target="_blank" href="https://www.wescheme.org/openEditor?publicId=LGTVNvzrax">Rocket-Height</a></li>
        <l
        i><a target="_blank" href="http://goo.gl/WnLnKb">Bug Hunting</a></li>
        <li><a target="_blank" href="http://goo.gl/PsG7MG">Sam the Butterfly</a></li>
        <li><a target="_blank" href="http://goo.gl/ftS9dm">Luigi's Pizza</a></li>
      </ul>
    </li>

		<li id="logout">
			<form id="logoutForm" method="POST" action="/logout">
			<input name="logout" value="Logout" type="submit">
			</form>
		</li>

	</ul>

</div>

<h1>My programs</h1>
<div id="programList">
The program list is being loaded.  Please wait.
</div>	

</div>
</body>
</html>
<% } %>
