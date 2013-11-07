<!-- IE9 fix for CM. See https://groups.google.com/forum/#!searchin/codemirror/whitespace/codemirror/xx_GCyYr5sE/dCH2KjBML2gJ -->
<!--[if IE 9]>
    <style> .CodeMirror pre {height: 1em; } </style>
<![endif]-->


<!-- Under IE8, excanvas doesn't work unless we get into IE7 standards
     mode.
     Warning: do NOT put HTML comments within the context of ifdefed code: it breaks badly
     under the iPhone browser.  -->

<!--[if lt IE 9]>
    <meta http-equiv="X-UA-Compatible" content="IE=7" />
    <script type="text/javascript" src="/js/compat/IE9-min.js"></script>
    <script src="/js/compat/excanvas-min.js" type="text/javascript"></script>
    <script src="/js/compat/ie-fixes-min.js" type="text/javascript"></script>
<![endif]-->



<!-- Compatibility for XMLHttpRequest -->
<script src="/js/compat/XMLHttpRequest-min.js" type="text/javascript"></script>
