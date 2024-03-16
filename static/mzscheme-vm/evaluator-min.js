var Evaluator=function(){var g=function(a){var c=this;this.write=a.write?a.write:function(b){};this.compilationServletUrl=a.compilationServletUrl?a.compilationServletUrl:"/servlets/standalone.ss";this.transformDom=a.transformDom?a.transformDom:function(b){if(helpers.isLocationDom(b)){var d=b;b=document.createElement("span");d=d.children;for(var f,e,h,k=0;k<d.length;k++)"location-id"===d[k].className&&(h=d[k].textContent),"location-line"===d[k].className&&(f=d[k].textContent),"location-column"===d[k].className&&
(e=d[k].textContent);b.appendChild(document.createElement("br"));b.appendChild(document.createTextNode("at line: "+f+", column: "+e+", in "+h))}return b};this.aState=new state.State;this.aState.setPrintHook(function(b){b=types.toDomNode(b);b=c.transformDom(b);c.write(b);helpers.maybeCallAfterAttach(b)});this.aState.setDisplayHook(function(b){var d=document.createElement("span");d.style.whiteSpace="pre-wrap";d.style.fontFamily="monospace";b=b.split("\n").filter(function(e){return""!==e});0<b.length&&
d.appendChild(document.createTextNode(b[0]));var f;for(f=1;f<b.length;f++)newline=document.createElement("br"),newline.style.clear="left",newline.className="value-seperator",d.appendChild(newline),d.appendChild(document.createTextNode(b[f]));d=c.transformDom(d);c.write(d);helpers.maybeCallAfterAttach(d)});this.aState.setToplevelNodeHook(function(){return c.makeToplevelNode()});this.aState.hooks.dynamicModuleLoader=function(b,d,f){c.dynamicModuleLoader(b,d,f)};this.dynamicModuleLoader=function(b,d,
f){n(c.rootLibraryPath+"/"+b+".js?__gensym="+encodeURIComponent(""+Math.random()),d,f)};this.rootLibraryPath="/collects"};g.prototype.setImageProxy=function(a){this.aState.setImageProxyHook(a)};g.prototype.setRootLibraryPath=function(a){this.rootLibraryPath=a};g.prototype.setDynamicModuleLoader=function(a){this.dynamicModuleLoader=a};g.prototype.makeToplevelNode=function(){var a=document.createElement("div"),c=document.createElement("div");c.appendChild(a);this.write(c);helpers.maybeCallAfterAttach(c);
return a};g.prototype.requestBreak=function(){this.aState.requestBreak()};g.prototype.executeProgram=function(a,c,b,d){var f=this;this.compileProgram(a,c,function(e){e=JSON.parse(e);f._onCompilationSuccess((0,eval)("("+e.bytecode+")"),b,d)},function(e){f._onCompilationFailure(JSON.parse(e||'""'),d)})};g.prototype.setCompileProgram=function(a){this.compileProgram=a};g.prototype.compileProgram=function(a,c,b,d){var f=this,e=p({name:a,program:c,format:"json","compiler-version":"1"}),h=new XMLHttpRequest;
h.onreadystatechange=function(){4==h.readyState&&(503==h.status?f.compileProgram(a,c,b,d):200===h.status?b(h.responseText):d(h.responseText))};h.open("POST",this.compilationServletUrl,!0);h.setRequestHeader("Content-type","application/x-www-form-urlencoded");h.send(e)};g.prototype.executeCompiledProgram=function(a,c,b){this.aState.clearForEval();try{interpret.load(a,this.aState)}catch(d){b(d);return}interpret.run(this.aState,c,b)};var q={}.hasOwnProperty,p=function(a){var c=[],b;for(b in a)q.call(a,
b)&&c.push(encodeURIComponent(b)+"="+encodeURIComponent(a[b]));return c.join("&")};g.prototype.getTraceFromExn=function(a){if(types.isSchemeError(a)){if(a=a.val,types.isExn(a)&&types.exnContMarks(a))return state.getStackTraceFromContinuationMarks(types.exnContMarks(a))}else if(types.isInternalError(a))return state.getStackTraceFromContinuationMarks(a.contMarks);return[]};g.prototype.getMessageFromExn=function(a){return"undefined"===typeof a?"internal undefined error":types.isSchemeError(a)?(a=a.val,
types.isExn(a)?types.exnMessage(a):a+""):types.isInternalError(a)?a.val+"":a.nodeType?a:a.message};g.prototype._onCompilationSuccess=function(a,c,b){this.executeCompiledProgram(a,c,b)};g.prototype._onCompilationFailure=function(a,c){"string"===typeof a?c(Error(a)):"object"===typeof a?c(this._convertErrorValue(a)):c(Error(a))};g.prototype._convertErrorValue=function(a){return a.type&&"exn:fail:read"===a.type?Error(a.message):a.type&&"moby-failure"===a.type?new r(this._convertDomSexpr(a["dom-message"]),
a["structured-error"]):Error(a+"")};var l=function(a){return types.vector([a.id,parseInt(a.offset),parseInt(a.line),parseInt(a.column),parseInt(a.span)])},m=function(a){var c=[],b;for(b=0;b<a.length;b++)c.push(l(a[b]));return c};m=function(a){var c=[],b;for(b=0;b<a.length;b++)c.push(l(a[b]));return c};var r=function(a,c){this.message=a.textContent||a.innerText||a;this.domMessage=a;if(c){this.structuredError=JSON.parse(c);a=this.structuredError.message;c=[];var b;for(b=0;b<a.length;b++)if("string"===
typeof a[b])c.push(a[b]);else if("ColoredPart"===a[b].type)c.push(new types.ColoredPart(a[b].text,l(a[b].loc)));else if("GradientPart"===a[b].type){var d,f=[];for(d=0;d<a[b].parts.length;d++){var e=a[b].parts[d];f.push(new types.ColoredPart(e.text,l(e.loc)))}c.push(new types.GradientPart(f))}else"MultiPart"===a[b].type?c.push(new types.MultiPart(a[b].text,m(a[b].locs),a[b].solid)):c.push(a[b]+"");this.message=(new types.Message(c)).toString()}else this.structuredError=void 0};g.prototype._convertDomSexpr=
function(a){if("number"===typeof a||"string"===typeof a){var c=document.createElement("span");c.appendChild(document.createTextNode(a+""));return c}if("object"===typeof a){c=document.createElement(a[0]);for(var b=a[1],d=0;d<b.length;d++)"style"===b[d][0]?c.style.cssText=b[d][1]:"class"===b[d][0]?c.className=b[d][1]:c[b[d][0]]=b[d][1];a=a.splice(2);for(d=0;d<a.length;d++)c.appendChild(this._convertDomSexpr(a[d]));return this.transformDom(c)}return a};var n=function(a,c,b){var d=arguments.callee;"queue"in
d||(d.queue={});var f=d.queue;if(a in f)c&&(f[a]?f[a].push(c):c());else{f[a]=c?[c]:[];var e=document.createElement("script");e.type="text/javascript";e.onload=e.onreadystatechange=function(){if(!e.readyState||"loaded"==e.readyState||"complete"==e.readyState){e.onreadystatechange=e.onload=null;document.getElementsByTagName("head")[0].removeChild(e);var h=f[a];for(delete f[a];h.length;)h.shift()()}};e.onerror=function(){e.onreadystatechange=e.onload=null;document.getElementsByTagName("head")[0].removeChild(e);
b()};e.src=a;document.getElementsByTagName("head")[0].appendChild(e)}};return g}();
