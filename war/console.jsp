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



<div class="header" style="position: fixed;">
    <h1 class="title">My Programs</h1>
    <h2>Welcome <%= s.getNickname() %></h2>
</div>



<div id="toolbar">
	<ul>
		<li class="start">
		  <a href="/openEditor" target="_blank">
		    Start a new program
		  </a>
		</li>

		<li class="logout">
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


</body>
</html>
<% } %>
