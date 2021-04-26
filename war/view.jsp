<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="com.google.appengine.api.users.User" %>
<%@ page import="com.google.appengine.api.users.UserService" %>
<%@ page import="com.google.appengine.api.users.UserServiceFactory" %>
<%@ page import="org.wescheme.user.SessionManager" %>
<%@ page import="org.wescheme.user.Session" %>
<%@ page import="org.wescheme.project.Program" %>
<%@ page import="org.wescheme.util.Queries" %>
<%@ page import="javax.jdo.PersistenceManager" %>
<%@ page import="org.wescheme.util.PMF" %>

<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>


<%
    Program aProgram = null;
    String publicId = request.getParameter("publicId");
    String encodedId = "";
    PersistenceManager pm = null;
    boolean isPublic = false;
    String title = "";
    String notes = "";

    if (publicId != null) {
        encodedId = java.net.URLEncoder.encode(publicId, "utf-8");
        pm = PMF.get().getPersistenceManager();
        try {
            aProgram = Queries.getProgramByPublicId(pm, publicId);
            title = aProgram.getTitle();
            notes = aProgram.getNotes();
            isPublic = aProgram.getIsSourcePublic();
        } catch (RuntimeException e) {
            aProgram = null;
        } finally {
            pm.close();
        }
    }

    if (publicId == null || aProgram == null) {
      response.setStatus(400);
    }


%>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head><title><c:out escapeXml="true" value="<%= title %>" /></title>
<meta name="robots" content="noindex">
<link rel="stylesheet" type="text/css" href="css/common.css" />
<link rel="stylesheet" type="text/css" href="css/view.css" id="style" />
<meta name="viewport" content="width=device-width, user-scalable=no" />

<!-- Do the right thing for mobile -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- Google analytics support -->
<jsp:include page="/google-analytics.jsp"/>


<script src="/js/jquery/jquery-1.3.2-min.js" type="text/javascript"></script>
<script src="/js/submitpost-min.js" type="text/javascript"></script>
<script src="/js/view-calc-min.js" type="text/javascript"></script>
</head>


<body>
  <h1 id="programTitle"><c:out escapeXml="true" value="<%= title %>" /></h1>
  <div id="publicId" style="display: none">
    <c:out escapeXml="true" value="<%= publicId %>" />
  </div>

  <% if (aProgram == null) { %>
    <%-- <script type="text/javascript">
    alert("Unable to load program");
    </script> --%>
    <div>
      <% if (publicId == null) { %>
        The <i>publicId</i> provided was blank. All shared WeScheme addresses must be of the form <br/><tt>www.wescheme.org/view?publicID=<i>public-program-id</i></tt>
      <% } else { %>
        WeScheme is unable to find the program with <i>publicId=<%= publicId %></i>.
        <br/>Please check the address to make sure the publicId is correct.
      <% } %>
    </div>
  <% } %>
  <main>
    <% if (aProgram != null) { %>
      <a id="runIt" class="button" aria-label="Run, F7" aria-describedby="runDescription"
         href="/run?publicId=<%= encodedId %>">Run
         <span class="tooltip" id="runDescription">Run the code &amp; show the output</span>
      </a>
    <% } %>

    <img id="Logo" src="css/images/BigLogo.png" alt="">

    <% if (aProgram != null && isPublic) { %>
      <a id="viewSource" class="button" aria-label="Edit, F8" aria-describedby="editDescription"
         href="/openEditor?publicId=<%= encodedId %>">Edit
          <span class="tooltip" id="runDescription">Open the code in a new editor</span>
      </a>

      <div id="notes">
        <c:out escapeXml="true" value="<%= notes %>" />
      </div>
    <% } %>

    <h2 id="bottomMessage" style="display: none" aria-hidden="true">
      Sometimes YouTube. Perhaps iPhone. Together, WeScheme!
    </h2>

    <% if (aProgram != null && isPublic) { %>
      <div id="socialBookmarks"><h2 class="screenreader-only">Share</h2></div>
    <% } %>

  </main>

  <jsp:include page="/footer.jsp"/>

</body>
<script type="text/javascript">
document.body.addEventListener("keydown", function(e){
  if(e.keyCode === 118) { 
    document.getElementById("runIt").click();
  }
});
</script>
</html>
