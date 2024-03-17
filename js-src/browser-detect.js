goog.provide('plt.wescheme.BrowserDetect');

/**
   A copy-and-paste of http://www.quirksmode.org/js/detect.html.  Detects
   what browser the user is using.

   Provides 3 properties:

   Browser name: BrowserDetect.browser
   Browser version: BrowserDetect.version
   OS name: BrowserDetect.OS

*/

plt.wescheme.BrowserDetect = {
    init: function () {
		this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
		this.version = this.searchVersionFloat(navigator.userAgent)
		    || this.searchVersionFloat(navigator.appVersion)
		    || undefined;
		this.versionString = this.searchVersionString(navigator.userAgent)
		    || this.searchVersionString(navigator.appVersion)
		    || "unknown";
		this.OS = this.searchString(this.dataOS) || "an unknown OS";
    },
    searchString: function (data) {
	for (var i=0;i<data.length;i++)	{
	    var dataString = data[i].string;
	    var dataProp = data[i].prop;
	    this.versionSearchString = data[i].versionSearch || data[i].identity;
	    if (dataString) {
		if (dataString.indexOf(data[i].subString) != -1)
		    return data[i].identity;
	    }
	    else if (dataProp)
		return data[i].identity;
	}
    },
    searchVersionString: function (dataString) {
	var index = dataString.indexOf(this.versionSearchString);
	if (index == -1) return;
	return dataString.substring(index+this.versionSearchString.length+1);
    },
    searchVersionFloat: function (dataString) {
	var index = dataString.indexOf(this.versionSearchString);
	if (index == -1) return;
	return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
    },
    dataBrowser: [
	{
	    string: navigator.userAgent,
	    subString: "Chrome",
	    identity: "Chrome"
	},
	{ 	string: navigator.userAgent,
		subString: "OmniWeb",
		versionSearch: "OmniWeb/",
		identity: "OmniWeb"
	},
	{
	    string: navigator.vendor,
	    subString: "Apple",
	    identity: "Safari",
	    versionSearch: "Version"
	},
	{
	    prop: window.opera,
	    identity: "Opera"
	},
	{
	    string: navigator.vendor,
	    subString: "iCab",
	    identity: "iCab"
	},
	{
	    string: navigator.vendor,
	    subString: "KDE",
	    identity: "Konqueror"
	},
	{
	    string: navigator.userAgent,
	    subString: "Firefox",
	    identity: "Firefox"
	},
	{
	    string: navigator.vendor,
	    subString: "Camino",
	    identity: "Camino"
	},
	{		// for newer Netscapes (6+)
	    string: navigator.userAgent,
	    subString: "Netscape",
	    identity: "Netscape"
	},
	{
	    string: navigator.userAgent,
	    subString: "MSIE",
	    identity: "Explorer",
	    versionSearch: "MSIE"
	},
	{
	    string: navigator.userAgent,
	    subString: "Gecko",
	    identity: "Mozilla",
	    versionSearch: "rv"
	},
	{ 		// for older Netscapes (4-)
	    string: navigator.userAgent,
	    subString: "Mozilla",
	    identity: "Netscape",
	    versionSearch: "Mozilla"
	},
	{ 		// for Edge
	    string: navigator.userAgent,
	    subString: "Edge",
	    identity: "Edge",
	    versionSearch: "Edge"
	}
    ],
    dataOS : [
	{
	    string: navigator.platform,
	    subString: "Win",
	    identity: "Windows"
	},
	{
	    string: navigator.platform,
	    subString: "Mac",
	    identity: "Mac"
	},
	{
	    string: navigator.userAgent,
	    subString: "iPhone",
	    identity: "iPhone/iPod"
	},
	{
	    string: navigator.platform,
	    subString: "Linux",
	    identity: "Linux"
	},
	{
	    string: navigator.platform,
	    subString: "android",
	    identity: "Android"
	}
    ]

};
plt.wescheme.BrowserDetect.init();