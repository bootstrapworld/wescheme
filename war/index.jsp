<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="com.google.appengine.api.users.User" %>
<%@ page import="com.google.appengine.api.users.UserService" %>
<%@ page import="com.google.appengine.api.users.UserServiceFactory" %>
<%@ page import="org.wescheme.user.SessionManager" %>
<%@ page import="org.wescheme.user.Session" %>

<%
SessionManager sm = new SessionManager();
Session s = sm.authenticate(request, response);
UserService us = UserServiceFactory.getUserService();
%>


<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>WeScheme</title>

    <!-- JQuery -->
    <script src="/js/jquery/jquery-1.3.2-min.js" type="text/javascript"></script>
    <script src="/js/jquery/jquery-ui-1.7.3.custom.min.js" type="text/javascript"></script>
    <link rel="stylesheet" type="text/css" href="/css/jquery-ui.css"/>

    <!-- The splash screen JavaScript libraries. -->
    <script src="/js/splash-calc-min.js" type="text/javascript"></script>


    <link rel="stylesheet" type="text/css" href="/css/common.css" />
    <link rel="stylesheet" type="text/css" href="/css/splash.css" id="style" />
    <meta name="google-signin-scope" content="profile email">
    <meta name="google-signin-client_id" content="981340394888-d28ji2vus7h06du2hgum27sf1mjs7ssm.apps.googleusercontent.com">
    <script src="https://accounts.google.com/gsi/client" async defer></script>

    <style>
        #loggedInWrapper, #loggedInWrapper { display: none; }
        #loginButton { margin:  -1px; }
    </style>

    <script type="text/javascript">
        var onOpenEditor = function() {
            window.location='/openEditor';
        };

        var onMyPrograms = function() {
            window.location='/console.jsp';
        };

        var onLogout = function() {
            if(confirm("You will be logged out of WeScheme and other Google services.")) {
                gapi.load('auth2', function() { 
                    gapi.auth2.getAuthInstance().signOut();
                    window.location='/logout';
                });
            }
        };

        function assignHandlers() {
            $("#startCoding").click(onOpenEditor);
            $("#loginButton").click(onLogin);
            $("#logoutButton").click(onLogout);
            $("#myPrograms").click(onMyPrograms);
        }
    </script>
</head>

<body onload="assignHandlers(); ">
<header><h1>WeScheme</h1></header>
<main>
    <div id="loggedOutWrapper">
        <a class="button" id="startCoding" aria-describedby="startCodingDescription" href="javascript: void(0)">Start Coding 
            <span class="tooltip" id="startCodingDescription">...without being able to save</span>
        </a>

        <img src="css/images/BigLogo.png" alt="">

        <a class="button" id="loginButton" aria-describedby="loginDescription" href="javascript: void(0)">
                <span class="tooltip" id="loginDescription">...to access your programs</span>
            <script src="https://accounts.google.com/gsi/client" async defer></script>
                <div id="g_id_onload"
                     data-client_id="981340394888-d28ji2vus7h06du2hgum27sf1mjs7ssm.apps.googleusercontent.com"
                     data-ux_mode="redirect"
                     data-login_uri="https://test-auth2-dot-wescheme-hrd-2.appspot.com/login.jsp">
                </div>
                <div class="g_id_signin" data-type="standard"></div>
        </a>
    </div>

    <div id="loggedInWrapper">
        <a class="button" id="myPrograms" aria-describedby="myProgramsDescription" href="javascript: void(0)">My Programs
            <span class="tooltip" id="myProgramsDescription">...see and manage my programs</span>
        </a>

        <img src="css/images/BigLogo.png" alt="">
<div class="g_id_signout">Sign Out</div>
        <a class="button" id="logoutButton" href="javascript: void(0)">Log Out
             <span class="tooltip" id="loginDescription">...of all Google services</span>
        </a>
    </div>

<div id="links">
    <a href="http://www.BootstrapWorld.org">Looking for a curriculum, too?</a>
</div>
</main>

<jsp:include page="/footer.jsp"/>
</body></html>