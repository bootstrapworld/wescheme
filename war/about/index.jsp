<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="com.google.appengine.api.users.User" %>
<%@ page import="com.google.appengine.api.users.UserService" %>
<%@ page import="com.google.appengine.api.users.UserServiceFactory" %>
<%@ page import="org.wescheme.user.SessionManager" %>
<%@ page import="org.wescheme.user.Session" %>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head><title>WeScheme :: About</title>

<!-- Do the right thing for mobile -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<script src="/js/jquery/jquery-1.3.2-min.js" type="text/javascript"></script>
<link rel="stylesheet" type="text/css" href="/css/splash.css" id="style" />

<!-- Google analytics support -->
<jsp:include page="/google-analytics.jsp"/>


</head>
<body>
<h1>WeScheme</h1><a href="/" class="headerlink"><img src="/css/images/BigLogo.png" width="20%"></a>
<h2>makes use of...</h2>
<div id="text">
<ul>
	<li><a href="http://appspot.com">AppEngine</a> : Google's cloud computing infrastructure. WeScheme uses AppEngine to handle user accounts, serverside compilation, and file management </li>
  <li><a href="http://excanvas.sourceforge.net/">ExCanvas</a> : Google's javascript library that provides a Canvas implementation on Internet Explorer 8, commonly used in schools with older tech. </li>
	<li><a href="http://code.google.com/closure/">Closure</a> : Google's javascript compiler, library and template system.</li>
	<li><a href="http://codemirror.net/">CodeMirror</a> : Marijn Haverbeke's library for in-browser editing.</li>
  <li><a href="http://easyxdm.net/wp/">EasyXDM</a> : a cross-domain messaging library.</li>
  <li><u><b>js-numbers</b></u> : A numeric-tower implementation from <a href="https://github.com/dyoo">Danny Yoo</a>, with significant contributions from <a href="https://github.com/danking">Dan King</a> and <a href="https://github.com/ds26gte">Dorai Sitarum</a>.</li>
</ul>
<p/>
The source to WeScheme itself is <a href="https://github.com/bootstrapworld/wescheme2012/">available for download</a>, under the <a href="http://www.gnu.org/copyleft/">GNU LGPL</a> license. Written by <a href="https://github.com/dyoo">Danny Yoo</a>, with significant contributions by <a href="https://github.com/schanzer">Emmanuel Schanzer</a>. Currently maintained by Emmanuel Schanzer. For more information about Danny Yoo's <a href="http://github.com/dyoo/moby-scheme">moby</a>, the compiler on which WeScheme's compiler is modeled, you can <a href="http://www.vidiowiki.com/watch/cydr9yk/#">watch the video</a> or <a href="http://www.cs.brown.edu/~sk/Publications/Papers/Published/yskf-wescheme/">read the paper</a>.
</div>


<jsp:include page="/footer.jsp"/>

</body></html>