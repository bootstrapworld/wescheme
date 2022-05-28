<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="com.google.appengine.api.users.User" %>
<%@ page import="com.google.appengine.api.users.UserService" %>
<%@ page import="com.google.appengine.api.users.UserServiceFactory" %>
<%@ page import="org.wescheme.user.SessionManager" %>
<%@ page import="org.wescheme.user.Session" %>
<%@ page import="java.util.logging.Logger" %>


<html>
<head><title>WeScheme</title>

<!-- Google analytics support -->
<jsp:include page="/google-analytics.jsp"/>


</head>
  <body>

<h1 class="title">WeScheme Login</h1>

<%
    Logger logger = Logger.getLogger("login");
 		// Are we logged in?
		SessionManager sm = new SessionManager();
		Session s = sm.authenticate(request, response);

		String passedToken = request.getParameter("idtoken");
		if (passedToken == null) {
			passedToken = request.getParameter("credential");
		}

		if( s != null ) {
			response.sendRedirect("/console");

		} else if(passedToken != null) {
			logger.info("I see the token! " + passedToken);
			
			s = sm.authOauth(passedToken);
			if( s != null ){				// we've authenticated
				sm.issueSession(s, response);	// issue the session
			} else {
				// Let's try to authenticate against WeScheme!
				s = sm.authWeScheme(request, response);
      		if( s != null ){
      			sm.issueSession(s, response);
      		}
      	}
    }
		if (request.getParameter("dest") != null) {
   	    response.sendRedirect(request.getParameter("dest"));
    } else {
        response.sendRedirect("/console"); 
    }
%>

  </body>
</html>
