
(function() {

// http://www.w3schools.com/JS/js_cookies.asp  
    var getCookie = function(c_name) {
	var c_start = -1;
	var c_end = -1;
	var text = document.cookie;
	if (text.length>0) {
	    c_start = text.indexOf(c_name + "=");
	    if (c_start!=-1) {
		c_start = c_start + c_name.length + 1;
		// According to http://tools.ietf.org/html/rfc2965,
		// the cookie value may be a quoted string.
		if (text.charAt(c_start) === '"') {
		    c_start++;
		    c_end = text.indexOf('"', c_start);
		} else {
		    c_end=text.indexOf(";",c_start);
		}
		if (c_end==-1){ c_end=text.length; }
		return text.substring(c_start,c_end);
	    }
	}
	return "";
    };
    

    // adapted from http://diveintogreasemonkey.org/patterns/override-method.html
    var newsubmit = function(event) {
	var target = event ? event.target : this;

	var tokenNode = document.createElement("input");
	tokenNode.setAttribute("type","hidden");
	tokenNode.setAttribute("name","token");
	tokenNode.setAttribute("value", getCookie("token"));
	target.appendChild(tokenNode);
	// call real submit function
	return this._submit.apply(this, arguments);
    };

    var instrumentedOpen = function() {
	var method = arguments[0].toUpperCase();
	var url = arguments[1];

	if (method.toUpperCase() == "GET") {
	    if (url.match(/\?/)) {
		url = url + "&" + "token=" + encodeURIComponent(getCookie("token"));
	    } else {
		url = url + "?" + "token=" + encodeURIComponent(getCookie("token"));
	    }
	    arguments[1] = url;
	}
	var result = this._open.apply(this, arguments);
	this.method = method;
	this.url = url;
	return result;
    };

    // if it's a GET request, OR isn't a wescheme request at all, use native send()
    var instrumentedSend = function(body){
	if (this.method == "GET" ||
		this.url.substring(0,4) === "http") {
	    return this._send.apply(this, arguments);
    // if it's a POST to a WeScheme server, attach the CSRF token
	} else {
	    if( body == null || body == ""){
		body = "?";
	    } else {
		body += "&";
	    }
	    body += "token=" + encodeURIComponent(getCookie("token"));
	    return this._send.call(this, body);
	}
    };


    // From http://msdn.microsoft.com/en-us/library/ms537509(VS.85).aspx
    var getInternetExplorerVersion = function()
    // Returns the version of Internet Explorer or a -1
    // (indicating the use of another browser).
    {
	var rv = undefined; // Return value assumes failure.
	if (navigator.appName == 'Microsoft Internet Explorer')
	{
	    var ua = navigator.userAgent;
	    var re  = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
	    if (re.exec(ua) != null)
		rv = parseFloat( RegExp.$1 );
	}
	return rv;
    };




    var isIE7OrBelow = function() {
	var version = getInternetExplorerVersion();
	return ((version != undefined) && (Math.floor(version) <= 7));
    };

    var isIE8 = function() {
	var version = getInternetExplorerVersion();
	return ((version != undefined) && (Math.floor(version) == 8));
    };
    

    //////////////////////////////////////////////////////////////////////

    // With the XMLHttpRequest compatibility library, we can do the XML stuff uniformly.
    XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function() {
	return instrumentedOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
	return instrumentedSend.apply(this, arguments);
    };
    
    //////////////////////////////////////////////////////////////////////
    // We now need to handle form submissions.
    if (isIE7OrBelow()) {
	// IE Hack for IE <=7
	Element = function () {};
	Element.prototype._submit = Element.prototype.submit;
	Element.prototype.submit = function() {
	    newsubmit.apply(this, arguments);
	}
	
    } else if (isIE8()) {
	HTMLFormElement.prototype._submit = HTMLFormElement.prototype.submit;
	HTMLFormElement.prototype.submit = function() {
	    return newsubmit.apply(this, arguments);
	};
    } else {
	// If a script calls someForm.submit(), the onsubmit event does not fire,
	// so we need to redefine the submit method of the HTMLFormElement class.
	if (typeof(HTMLFormElement) == 'undefined') {
	    HTMLFormElement = function() {};
	    new HTMLFormElement();
	}
	HTMLFormElement.prototype._submit = HTMLFormElement.prototype.submit;
	HTMLFormElement.prototype.submit = function(event) {
	    return newsubmit.apply(this, arguments);
	}
    }
}());