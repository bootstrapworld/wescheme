goog.provide("plt.wescheme.helpers");

// if (typeof (plt) === 'undefined') {
//     this.plt = {};
// }
// if (typeof (plt.wescheme) === 'undefined') {
//     this.plt.wescheme = {};
// }

// plt.wescheme.helpers = {};


(function() {
    // makeShareUrl: string -> string
    // Produces the sharing url.
    plt.wescheme.helpers.makeShareUrl = function(publicId) {
	var a = document.createElement("a");
	a.href = "/view?publicId=" + encodeURIComponent(publicId);
	// slightly funny, but the browser normalizes href on assignment.
	return a.href; 
    };


    // urlToAnchor: string -> anchor-element
    plt.wescheme.helpers.urlToAnchor = function(url) {
	var a = document.createElement("a");
	a.appendChild(document.createTextNode(url));
	a.href = url;
	return a;
    };


    plt.wescheme.helpers.trimWhitespace = function(s) {
	s = s.replace(new RegExp("^\\s+"), "");
	s = s.replace(new RegExp("\\s+$"), "");
	return s;
    };



    // generateSocialBookmarks: string string -> span-element
    // Makes a social bookmarks span, given a title and a URL to link to.
    plt.wescheme.helpers.generateSocialBookmarks = function(title, url) {

		var list = document.createElement("ul");
		list.className = "socialBookmarks";
		var addBookmarklet = function(name, imgSrc, url) {
		    var a = document.createElement("a");
		    var img = document.createElement("img");
		    var li = document.createElement("li");
		    a.className = "socialBookmarklet";
		    a.title = "Share via " + name;
		    img.src = imgSrc;
		    img.alt = "Share via " + name;
		    img.className = "socialBookmarklet";
		    a.appendChild(img);
		    a.href = url;
	        a.target = "_blank";
	        li.appendChild(a);
		    list.appendChild(li);
		};

		var encodeKeyPairs = function(attrs) {
		    var key, buffer = [];
		    for (key in attrs) {
			if (Object.hasOwnProperty.call(attrs, key)) {
			    buffer.push(key + "=" + encodeURIComponent(attrs[key]));
			}
		    }
		    return buffer.join("&");
		}


		addBookmarklet("email",
			       "/images/icon_email.png",
			       "https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1" +
	            encodeKeyPairs({su: title,
	                            body: url}));

		addBookmarklet("Facebook",
	                 "/images/icon_facebook.png",
	                 "http://www.facebook.com/sharer.php" + "?" +
	                 encodeKeyPairs({u: url,
	                                t: title}));
	 
		addBookmarklet("Twitter",
			       "/images/icon_twitter.png",
			       "http://twitter.com/home?" +
			       encodeKeyPairs({status: url}));

		addBookmarklet("Pinterest",
	                 "/images/icon_pinterest.png",
	                 "http://pinterest.com/pin/create/button/?" +
	                 encodeKeyPairs({url: url,
	                                description: title}));
	 
		addBookmarklet("Reddit",
	                 "/images/icon_reddit.png",
	                 "http://www.reddit.com/submit?" +
	                 encodeKeyPairs({url: url,
	                                title: title}));
	 
		addBookmarklet("Barcode",
					"/images/icon_qrcode.png",
					"http://qrcode.kaywa.com/img.php" + "?" + 
					   encodeKeyPairs({s: 8, d: url}));
	 
		 return list;
    };


    var zpad = function(s) {
	if ((s+'').length == 1) {
	    return "0" + s;
	} else {
	    return s;
	}
    };

    // prettyPrintDate: string -> string
    plt.wescheme.helpers.prettyPrintDate = function(modified) {
	var modifiedDate = new Date();
	modifiedDate.setTime(parseInt(modified));


	var day = modifiedDate.getUTCDate();
	var month = modifiedDate.getUTCMonth() + 1;
	var year = modifiedDate.getFullYear();
	var time = (((modifiedDate.getHours() % 12) == 0 ?
		     12 :
		     (modifiedDate.getHours() % 12))
		    + ":" 
		    + zpad(modifiedDate.getMinutes())
		    + (modifiedDate.getHours() >= 12 ? "pm" : "am" ));
	return day + "/" + month + "/" + year + ", " + time;
    };




})();