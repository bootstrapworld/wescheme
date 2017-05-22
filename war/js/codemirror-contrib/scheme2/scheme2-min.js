(function(){function o(a,b){var c=RegExp("[\\s\\u00a0]"),d=/[\s\(\)\[\]\{\}\"\,\'\`\;]/,e=/[^\s\(\)\[\]\{\}\"\,\'\`\;]/,h=[RegExp("^((?:(?:\\#[ei])?[+\\-]?(?:(?:\\d+\\/\\d+)|(?:(?:\\d+\\.\\d+|\\d+\\.|\\.\\d+)(?:[eE][+\\-]?\\d+)?)|(?:\\d+(?:[eE][+\\-]?\\d+)?)))?(?:[+\\-](?:(?:\\d+\\/\\d+)|(?:(?:\\d+\\.\\d+|\\d+\\.|\\.\\d+)(?:[eE][+\\-]?\\d+)?)|(?:\\d+(?:[eE][+\\-]?\\d+)?)))i$)"),/^((?:\#[ei])?[+-]inf.0)$/,/^((?:\#[ei])?[+-]nan.0)$/,RegExp("^((?:\\#[ei])?[+\\-]?(?:(?:\\d+\\/\\d+)|(?:(?:\\d+\\.\\d+|\\d+\\.|\\.\\d+)(?:[eE][+\\-]?\\d+)?)|(?:\\d+(?:[eE][+\\-]?\\d+)?))$)"),
/^0[xX][0-9A-Fa-f]+$/],i=function(a){for(var b=0;b<h.length;b++)if(h[b].test(a))return!0;return!1},g=function(){a.eatWhile(e);var b=a.current();return i(b)?{type:"number",style:"scheme-number",content:b}:"true"===b||"false"===b?{type:"variable",style:"scheme-boolean",content:b}:{type:"variable",style:"scheme-symbol",content:b}},m=function(c){if('"'===c&&b.inString)b.inString=!1;else{b.inString=!0;a:{for(c=!1;;){if(a.eol()){c=!0;break a}var d=a.next();if('"'==d&&!c)break;c=!c&&"\\"==d}c=!1}c||(b.inString=
!1)}return{type:"string",style:"scheme-string",content:a.current()}},p=function(){var b;if(";"===a.peek())return a.next(),b=a.current(),{type:b,style:"scheme-symbol",content:b};a.eatWhile(e);b=a.current();return i(b)?{type:"number",style:"scheme-number",content:b}:{type:"symbol",style:"scheme-symbol",content:b}},f=a.next(),j=null;"\n"===f&&(j={type:"whitespace",style:"whitespace",content:a.current()});b.inString?c=m(f):c.test(f)?(a.eatSpace(),c={type:"whitespace",style:"whitespace",content:a.current()}):
"#"===f?c=p():";"===f?(a.skipToEnd(),c={type:"comment",style:"scheme-comment",content:a.current()}):c='"'===f?m(f):d.test(f)?{type:f,style:"scheme-punctuation"}:g();j=c;j.value=a.current();j.column=a.column();return j}var q=function(a){for(var b=[],c=[],d=0,e=[];a!==k;){d++;e.push(a[0]);if("("===a[0].type||"["===a[0].type||"{"===a[0].type)if(0===c.length)break;else{var h=a[0].value,i=c[c.length-1];if("("===h&&")"===i||"["===h&&"]"===i||"{"===h&&"}"===i)c.pop();else return b}else(")"===a[0].type||
"]"===a[0].type||"}"===a[0].type)&&c.push(a[0].type);a=a[1]}if(a===k)return b;for(a=a[1];a!==k&&!("whitespace"===a[0].type&&"\n"===a[0].value);){e.push(a[0]);a=a[1]}b=[];for(a=e.length-1;0<=a;a--)a<d&&b.push({type:e[a].type,value:e[a].value,column:e[a].column});return b},u=function(a){if(0===a.length)return 0;var b=g(a,0);if(-1===b?0:/^begin/.test(a[b].value)||l(a[b].value,r))return n(a);b=g(a,0);if(-1===b?0:/^def/.test(a[b].value)||l(a[b].value,s))return b=g(a,0),-1===b?0:a[b].column+1;b=g(a,0);
(-1===b?0:l(a[b].value,t))?(b=g(a,0),a=-1===b?0:-1===g(a,1)?a[b].column+4:a[b].column+1):a=n(a,0);return a},g=function(a,b){for(var c=0,d=0;d<a.length;d++){if("whitespace"!==a[d].type&&1===c){if(0===b)return d;b--}("("===a[d].type||"["===a[d].type||"{"===a[d].type)&&c++;(")"===a[d].type||"]"===a[d].type||"}"===a[d].type)&&(c=Math.max(c-1,0))}return-1},r="case-lambda,compound-unit,compound-unit/sig,cond,delay,inherit,match-lambda,match-lambda*,override,private,public,sequence,unit".split(","),n=function(a,
b){"undefined"===typeof b&&(b=1);for(var c=0,d,e=[];-1!=(d=g(a,c++));)e.push(d);if(0===e.length)return a[0].column+1;if(1===e.length)return a[e[0]].column+b;for(c=e.length-1;1<c&&!(a[e[c]].line!==a[e[c-1]].line);c--);return a[e[c]].column},s=["local"],t="cases,instantiate,super-instantiate,syntax/loc,quasisyntax/loc,lambda,let,let*,letrec,recur,lambda/kw,letrec-values,with-syntax,with-continuation-mark,module,match,match-let,match-let*,match-letrec,let/cc,let/ec,letcc,catch,let-syntax,letrec-syntax,fluid-let-syntax,letrec-syntaxes+values,for,for/list,for/hash,for/hasheq,for/and,for/or,for/lists,for/first,for/last,for/fold,for*,for*/list,for*/hash,for*/hasheq,for*/and,for*/or,for*/lists,for*/first,for*/last,for*/fold,kernel-syntax-case,syntax-case,syntax-case*,syntax-rules,syntax-id-rules,let-signature,fluid-let,let-struct,let-macro,let-values,let*-values,case,when,unless,let-enumerate,class,class*,class-asi,class-asi*,class*/names,class100,class100*,class100-asi,class100-asi*,class100*/names,rec,make-object,mixin,define-some,do,opt-lambda,send*,with-method,define-record,catch,shared,unit/sig,unit/lang,with-handlers,interface,parameterize,call-with-input-file,call-with-input-file*,with-input-from-file,with-input-from-port,call-with-output-file,with-output-to-file,with-output-to-port,for-all".split(","),
l=function(a,b){for(var c=0;c<b.length;c++)if(a===b[c])return!0;return!1},k=[],v=function(){return{tokenStack:k,inString:!1}},w=function(a,b){var c=o(a,b);b.tokenStack=[c,b.tokenStack];return c.style},x=function(a){a=q(a.tokenStack);return u(a)},y=function(a){return{tokenStack:a.tokenStack,inString:a.inString}},z=function(a){a.tokenStack=[{type:"whitespace",style:"whitespace",content:"\n"},a.tokenStack]};CodeMirror.defineMode("scheme2",function(){return{startState:v,token:w,indent:x,copyState:y,blankLine:z}});
CodeMirror.defineInitHook(function(a){a.showArrows=!1;var b=document.createElementNS("http://www.w3.org/2000/svg","svg");b.style.position="absolute";b.style.top="0px";b.style.left="30px";b.style.width="0px";b.style.height="0px";a.getScrollerElement().appendChild(b);var c=document.createElementNS("http://www.w3.org/2000/svg","defs"),d=document.createElementNS("http://www.w3.org/2000/svg","marker"),e=document.createElementNS("http://www.w3.org/2000/svg","path"),h=document.createElementNS("http://www.w3.org/2000/svg",
"g");d.setAttribute("id","arrow");d.setAttribute("markerWidth","10");d.setAttribute("markerHeight","8");d.setAttribute("refX","12");d.setAttribute("refY","6");d.setAttribute("orient","auto");e.setAttribute("d","M2,2 L2,11 L10,6 L2,2");e.setAttribute("style","fill: black");b.appendChild(c);c.appendChild(d);d.appendChild(e);b.appendChild(h);CodeMirror.on(a.getWrapperElement(),"mousemove",function(c){function d(c){var f=a.charCoords(a.posFromIndex(Number(c.start)),"local"),j=a.charCoords(e,"local"),
g=Math.floor(f.right),i=Math.floor(f.top+a.defaultTextHeight()/2),k=Math.floor(j.left),l=Math.floor(j.top+a.defaultTextHeight()/2),c="use"===c.dir?"blue":"red",g="M"+k+","+l+" L"+g+","+i,i=document.createElementNS("http://www.w3.org/2000/svg","path");i.setAttribute("d",g);i.setAttribute("style","stroke: "+c+"; fill: none; stroke-width: 1px; marker-end: url(#arrow);");b.style.width=Math.max(parseInt(b.style.width),j.right,f.right)+"px";b.style.height=Math.max(parseInt(b.style.height),j.bottom,f.bottom)+
"px";h.appendChild(i)}if(a.getOption("showArrows")){for(;h.firstChild;)h.removeChild(h.firstChild);b.style.width=b.style.height="10px";var e=a.coordsChar({left:c.clientX,top:c.clientY});(c=a.findMarksAt(e).filter(function(a){return a._targets})[0])&&c._targets.forEach(d)}})});CodeMirror.defineOption("showArrows",!1,function(){})})();