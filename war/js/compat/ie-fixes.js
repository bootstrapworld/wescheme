// Ugly compability hack for IE: ensure that Node is defined.
if (window && !window['Node']) {
    window.Node = new Object();
    Node.ELEMENT_NODE = 1;
    Node.ATTRIBUTE_NODE = 2;
    Node.TEXT_NODE = 3;
    Node.CDATA_SECTION_NODE = 4;
    Node.ENTITY_REFERENCE_NODE = 5;
    Node.ENTITY_NODE = 6;
    Node.PROCESSING_INSTRUCTION_NODE = 7;
    Node.COMMENT_NODE = 8;
    Node.DOCUMENT_NODE = 9;
    Node.DOCUMENT_TYPE_NODE = 10;
    Node.DOCUMENT_FRAGMENT_NODE = 11;
    Node.NOTATION_NODE = 12;
}
    

// Adding Array.indexOf if it doesn't exist yet.
// http://soledadpenades.com/2007/05/17/arrayindexof-in-internet-explorer/
if(!Array.indexOf){
    Array.prototype.indexOf = function(obj){
	for(var i=0; i < this.length; i++){
	    if(this[i] == obj){
	        return i;
	    }
	}
	return -1;
    }
}



// Try to avoid image flicker on hover.
// See:
// http://www.telerik.com/help/aspnet/tabstrip/tabstrip_imageflicker.html
try {
    document.execCommand("BackgroundImageCache", false, true);
} catch(err) {}


// add Array.map
// taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Map#Polyfill
if (!Array.prototype.map){
  Array.prototype.map = function(fun /*, thisArg */)
  {
    "use strict";
    
    if (this === void 0 || this === null)
      throw new TypeError();
    
    var t = Object(this);
    var len = t.length >>> 0;
    if (typeof fun !== "function")
      throw new TypeError();
    
    var res = new Array(len);
    var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
    for (var i = 0; i < len; i++)
    {
      // NOTE: Absolute correctness would demand Object.defineProperty
      //       be used.  But this method is fairly new, and failure is
      //       possible only if Object.prototype or Array.prototype
      //       has a property |i| (very unlikely), so use a less-correct
      //       but more portable alternative.
      if (i in t)
        res[i] = fun.call(thisArg, t[i], i, t);
    }
    
    return res;
  };
}

// add Array.map
// taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#Polyfill
if ( 'function' !== typeof Array.prototype.reduce ) {
  Array.prototype.reduce = function( callback /*, initialValue*/ ) {
    'use strict';
    if ( null === this || 'undefined' === typeof this ) {
      throw new TypeError(
                          'Array.prototype.reduce called on null or undefined' );
    }
    if ( 'function' !== typeof callback ) {
      throw new TypeError( callback + ' is not a function' );
    }
    var t = Object( this ), len = t.length >>> 0, k = 0, value;
    if ( arguments.length >= 2 ) {
      value = arguments[1];
    } else {
      while ( k < len && ! k in t ) k++;
      if ( k >= len )
        throw new TypeError('Reduce of empty array with no initial value');
      value = t[ k++ ];
    }
    for ( ; k < len ; k++ ) {
      if ( k in t ) {
        value = callback( value, t[k], k, t );
      }
    }
    return value;
  };
}

// add Array.map
// taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#Polyfill
if ( 'function' !== typeof Array.prototype.reduceRight ) {
  Array.prototype.reduceRight = function( callback /*, initialValue*/ ) {
    'use strict';
    if ( null === this || 'undefined' === typeof this ) {
      throw new TypeError(
                          'Array.prototype.reduce called on null or undefined' );
    }
    if ( 'function' !== typeof callback ) {
      throw new TypeError( callback + ' is not a function' );
    }
    var t = Object( this ), len = t.length >>> 0, k = len - 1, value;
    if ( arguments.length >= 2 ) {
      value = arguments[1];
    } else {
      while ( k >= 0 && ! k in t ) k--;
      if ( k < 0 )
        throw new TypeError('Reduce of empty array with no initial value');
      value = t[ k-- ];
    }
    for ( ; k >= 0 ; k-- ) {
      if ( k in t ) {
        value = callback( value, t[k], k, t );
      }
    }
    return value;
  };
}