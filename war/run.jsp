<%-- Runs a program
     Url scheme:

     http://www.wescheme.org/run?publicId=...
--%>

<jsp:directive.page contentType="text/html;charset=UTF-8" language="java" />
<%
    String publicId = request.getParameter("publicId");

    String compilationServerUrl = (new org.wescheme.project.WeSchemeProperties(getServletContext())).getCompilationServerUrl();
%>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
<meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
<meta name="apple-mobile-web-app-capable" content="yes">

<title>WeScheme</title>


<!-- Google analytics support -->
<jsp:include page="/google-analytics.jsp"/>


<!-- Add compatibility libraries for IE. -->
<jsp:include page="/js/compat/compat.jsp"/>

<link rel="stylesheet" type="text/css" href="/css/common.css" />
<link rel="stylesheet" type="text/css" href="/css/pretty-printing.css" id="style" />

<style>
  body{
    background: url(css/images/bootBG.png) no-repeat fixed white;
    background-position: bottom right; width: 100%;
    margin: 0px;
    font-family: Lato, Century Gothic, Arial, Helvetica, sans-serif;
    text-align: center;
  }
  #description{
    margin: 20px;
    display: block;
    border-top: solid 2px black;
  }
  #title{
    display: block;
    font-size: 40px;
    border-bottom: solid 2px;
    margin: 20px;
    padding-bottom: 20px;
  }
  #interactions{ white-space: pre; font-family: monospace; display: inline-block;}
  #fullscreenButton{ margin-right: 20px; }

</style>
<script src="/js/jquery/jquery-1.3.2-min.js" type="text/javascript"></script>
<script src="/editor/jquery.createdomnodes-min.js" type="text/javascript"></script>
<script src="/js/easyXDM/easyXDM-min.js" type="text/javascript"></script>
<script type="text/javascript">
    easyXDM.DomHelper.requiresJSON("/js/easyXDM/json2-min.js");
</script>
<script src="/js/mzscheme-vm/support-min.js" type="text/javascript"></script>
<script src="/js/mzscheme-vm/evaluator-min.js" type="text/javascript"></script>
<script src="/js/loadScript-min.js" type="text/javascript"></script>
<script src="/js/run-calc-min.js" type="text/javascript"></script>

</head>

<body onload="plt.wescheme.runner.init('<%= compilationServerUrl %>', '<%= publicId%>')">
  <main id="interactions" role="log" aria-live="assertive">
  </main>
  <jsp:include page="/footer.jsp"/>
</body>
</html>
