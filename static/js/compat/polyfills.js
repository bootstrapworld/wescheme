// if it's IE 11 or any older IE, load polyfills
if(  !!navigator.userAgent.match(/Trident\/7\./)
  || window.navigator.userAgent.indexOf("MSIE") > 0) {
  console.log('loading IE polyfills for compatibility');

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
  if (!Array.prototype.reduce ) {
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
  if (!Array.prototype.reduceRight ) {
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

  // add Array.includes
  // taken from https://tc39.github.io/ecma262/#sec-array.prototype.includes
  if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
      value: function(searchElement, fromIndex) {

        // 1. Let O be ? ToObject(this value).
        if (this == null) {
          throw new TypeError('"this" is null or not defined');
        }

        var o = Object(this);

        // 2. Let len be ? ToLength(? Get(O, "length")).
        var len = o.length >>> 0;

        // 3. If len is 0, return false.
        if (len === 0) {
          return false;
        }

        // 4. Let n be ? ToInteger(fromIndex).
        //    (If fromIndex is undefined, this step produces the value 0.)
        var n = fromIndex | 0;

        // 5. If n ≥ 0, then
        //  a. Let k be n.
        // 6. Else n < 0,
        //  a. Let k be len + n.
        //  b. If k < 0, let k be 0.
        var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

        function sameValueZero(x, y) {
          return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
        }

        // 7. Repeat, while k < len
        while (k < len) {
          // a. Let elementK be the result of ? Get(O, ! ToString(k)).
          // b. If SameValueZero(searchElement, elementK) is true, return true.
          // c. Increase k by 1. 
          if (sameValueZero(o[k], searchElement)) {
            return true;
          }
          k++;
        }

        // 8. Return false
        return false;
      }
    });
  }

  // add String.includes
  // taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
  if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
      'use strict';
      if (typeof start !== 'number') {
        start = 0;
      }
      
      if (start + search.length > this.length) {
        return false;
      } else {
        return this.indexOf(search, start) !== -1;
      }
    };
  }
} else {
  console.log('Not IE, so no polyfills needed!');
}