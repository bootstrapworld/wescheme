//////////////////////////////////////////////////////////////////////
// helper functions

//var jsnums = require('./js-numbers');
var types = {};
(function () {

var hasOwnProperty = {}.hasOwnProperty;

//////////////////////////////////////////////////////////////////////
var _eqHashCodeCounter = 0;
makeEqHashCode = function() {
    _eqHashCodeCounter++;
    return _eqHashCodeCounter;
};
// getHashCode: any -> (or fixnum string)
// Produces a hashcode appropriate for eq.
getEqHashCode = function(x) {
    if (x && !x._eqHashCode) {
	x._eqHashCode = makeEqHashCode();
    }
    if (x && x._eqHashCode) {
	return x._eqHashCode;
    }
    if (typeof(x) == 'string') {
	return x;
    }
    return 0;
};
// Union/find for circular equality testing.
var UnionFind = function() {
	// this.parenMap holds the arrows from an arbitrary pointer
	// to its parent.
	this.parentMap = makeLowLevelEqHash();
}

// find: ptr -> UnionFindNode
// Returns the representative for this ptr.
UnionFind.prototype.find = function(ptr) {
	var parent = (this.parentMap.containsKey(ptr) ? 
		      this.parentMap.get(ptr) : ptr);
	if (parent === ptr) {
	    return parent;
	} else {
	    var rep = this.find(parent);
	    // Path compression:
	    this.parentMap.put(ptr, rep);
	    return rep;
	}
};

// merge: ptr ptr -> void
// Merge the representative nodes for ptr1 and ptr2.
UnionFind.prototype.merge = function(ptr1, ptr2) {
	this.parentMap.put(this.find(ptr1), this.find(ptr2));
};

//////////////////////////////////////////////////////////////////////
// simpleToDomNode : String String String -> <SPAN>
// Consumes the displayed contents and the ariaText, and produces a span
function simpleToDomNode(contents, className, ariaText) {
	var wrapper = document.createElement("span");
    wrapper.className = className;
	wrapper.ariaText = ariaText;
	wrapper.setAttribute("aria-label", ariaText);
    wrapper.appendChild(document.createTextNode(contents));
    return wrapper;
}

//////////////////////////////////////////////////////////////////////
// Class inheritance infrastructure
// This code copied directly from http://ejohn.org/blog/simple-javascript-inheritance/
var Class = (function(){
	var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
	// The base Class implementation (does nothing)
	var innerClass = function(){};
	
	// Create a new Class that inherits from this class
	innerClass.extend = function(prop) {
		var _super = this.prototype;
		
		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		var prototype = new this();
		initializing = false;
		
		// Copy the properties over onto the new prototype
		for (var name in prop) {
			// Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] == "function" && 
				typeof _super[name] == "function" && fnTest.test(prop[name]) ?
				(function(name, fn){
					return function() {
						var tmp = this._super;
						
						// Add a new ._super() method that is the same method
						// but on the super-class
						this._super = _super[name];
						
						// The method only need to be bound temporarily, so we
						// remove it when we're done executing
						var ret = fn.apply(this, arguments);				
						this._super = tmp;
						
						return ret;
					};
				})(name, prop[name]) :
				prop[name];
		}
		
		// The dummy class constructor
		var Dummy = function() {
			// All construction is actually done in the init method
			if ( !initializing && this.init )
				this.init.apply(this, arguments);
		}
		
		// Populate our constructed prototype object
		Dummy.prototype = prototype;
		
		// Enforce the constructor to be what we expect
		Dummy.constructor = Dummy;

		// And make this class extendable
		Dummy.extend = arguments.callee;
		
		return Dummy;
	};
	return innerClass;
})();
 
function makeLParen(){
   var node = document.createElement('span');
   node.appendChild(document.createTextNode("("));
   node.className = "lParen";
   return node;
}

function makeRParen(){
   var node = document.createElement('span');
   node.appendChild(document.createTextNode(")"));
   node.className = "rParen";
   return node;
}

//////////////////////////////////////////////////////////////////////
// Struct Types
StructType = function(name, type, numberOfArgs, numberOfFields, firstField,
		      constructor, predicate, accessor, mutator) {
	this.name = name;
	this.type = type;
	this.numberOfArgs = numberOfArgs;
	this.numberOfFields = numberOfFields;
	this.firstField = firstField;

	this.constructor = constructor;
	this.predicate = predicate;
	this.accessor = accessor;
	this.mutator = mutator;
};
StructType.prototype.toString = function() {
	return '#<struct-type:' + this.name + '>';
};
StructType.prototype.isEqual = function(other, aUnionFind) {
	return this === other;
};
var makeStructureType = function(theName, parentType, initFieldCnt, autoFieldCnt, autoV, guard) {
    // If no parent type given, then the parent type is Struct
    if ( !parentType ) {
	parentType = ({type: Struct,
		       numberOfArgs: 0,
		       numberOfFields: 0,
		       firstField: 0});
    }
    var numParentArgs = parentType.numberOfArgs;

    // Create a new struct type inheriting from the parent
    var aStruct = parentType.type.extend({
	init: function(name, initArgs) {
		// if there's no guard, construct a default one

		if (!guard) {
			guard = function(k) {
				if (arguments.length == 3) {
					k(arguments[1]);
				}
				else {
					var args = [];
					var i;
					for(i = 1; i < arguments.length-1; i++) {
						args.push(arguments[i]);
					}
					k(new ValuesWrapper(args));
				}
			}
		}

		var that = this;
		var cont = function(guardRes) {
			var guardedArgs;
			if ( guardRes instanceof ValuesWrapper ) {
				guardedArgs = guardRes.elts;
			} else {
				guardedArgs = [guardRes];
			}
			
			var parentArgs = guardedArgs.slice(0, numParentArgs);
			that._super(name, parentArgs);

			for (var i = 0; i < initFieldCnt; i++) {
				that._fields.push(guardedArgs[i+numParentArgs]);
			}
			for (var i = 0; i < autoFieldCnt; i++) {
				that._fields.push(autoV);
			}
		};
		initArgs.unshift(cont);
		initArgs.push(Symbol.makeInstance(name));
		guard.apply(null, initArgs);
	}
    });
    // Set type, necessary for equality checking
    aStruct.prototype.type = aStruct;

    // construct and return the new type
    return new StructType(theName,
			  aStruct,
			  initFieldCnt + numParentArgs,
			  initFieldCnt + autoFieldCnt,
			  parentType.firstField + parentType.numberOfFields,
			  function() {
			  	var args = [];
				for (var i = 0; i < arguments.length; i++) {
					args.push(arguments[i]);
				}
				return new aStruct(theName, args);
			  },
			  function(x) { return x instanceof aStruct; },
			  function(x, i) { return x._fields[i + this.firstField]; },
			  function(x, i, v) { x._fields[i + this.firstField] = v; });
};
// Structures.
var Struct = Class.extend({
	init: function (constructorName, fields) {
	    this._constructorName = constructorName; 
	    this._fields = [];
	},

	toWrittenString: function(cache) { 
	    //    cache.put(this, true);
	    var buffer = [];
	    var i;
	    buffer.push("(");
	    buffer.push(this._constructorName);
	    for(i = 0; i < this._fields.length; i++) {
			buffer.push(" ");
			buffer.push(toWrittenString(this._fields[i], cache));
	    }
	    buffer.push(")");
	    return buffer.join("");
	},

	toDisplayedString: this.toWrittenString,

	toDomNode: function(cache) {
	    //    cache.put(this, true);
	    var wrapper = document.createElement("span"),
            constructor= document.createElement("span");
            constructor.appendChild(document.createTextNode(this._constructorName)),
            ariaText = this._constructorName + ":";
	    var i;
	    wrapper.appendChild(makeLParen());
	    wrapper.appendChild(constructor);
	    for(i = 0; i < this._fields.length; i++) {
	    	var dom = toDomNode(this._fields[i], cache);
	    	ariaText += " "+dom.ariaText;
            wrapper.appendChild(dom);
	    }
	    wrapper.appendChild(makeRParen());
	    wrapper.ariaText = ariaText;
	    wrapper.setAttribute("aria-label", ariaText);
	    return wrapper;
	},


	isEqual: function(other, aUnionFind) {
	    if ( other.type == undefined ||
		 this.type !== other.type ||
		 !(other instanceof this.type) ) {
		    return false;
	    }

	    for (var i = 0; i < this._fields.length; i++) {
		if (! isEqual(this._fields[i],
			      other._fields[i],
			      aUnionFind)) {
			return false;
		}
	    }
	    return true;
	}
});
Struct.prototype.type = Struct;

//////////////////////////////////////////////////////////////////////
// Hashtables
// makeLowLevelEqHash: -> hashtable
// Constructs an eq hashtable that uses Moby's getEqHashCode function.
var makeLowLevelEqHash = function() {
    return new _Hashtable(function(x) { return getEqHashCode(x); },
			  function(x, y) { return x === y; });
};

var EqHashTable = function(inputHash) {
    this.hash = makeLowLevelEqHash();
    this.mutable = true;

};
EqHashTable = EqHashTable;
EqHashTable.prototype.toWrittenString = function(cache) {
    var keys = this.hash.keys();
    var ret = [];
    for (var i = 0; i < keys.length; i++) {
	    var keyStr = types.toWrittenString(keys[i], cache);
	    var valStr = types.toWrittenString(this.hash.get(keys[i]), cache);
	    ret.push('(' + keyStr + ' . ' + valStr + ')');
    }
    return ('#hasheq(' + ret.join(' ') + ')');
};
EqHashTable.prototype.toDisplayedString = EqHashTable.prototype.toWrittenString;
EqHashTable.prototype.isEqual = function(other, aUnionFind) {
    if ( !(other instanceof EqHashTable) ) {
		return false; 
    }
    if (this.hash.keys().length != other.hash.keys().length) { 
		return false;
    }
    var keys = this.hash.keys();
    for (var i = 0; i < keys.length; i++){
		if ( !(other.hash.containsKey(keys[i]) &&
		       isEqual(this.hash.get(keys[i]),
			       other.hash.get(keys[i]),
			       aUnionFind)) ) {
			return false;
		}
    }
    return true;
};
var EqualHashTable = function(inputHash) {
	this.hash = new _Hashtable(function(x) {
			return toWrittenString(x); 
		},
		function(x, y) {
			return isEqual(x, y, new UnionFind()); 
		});
	this.mutable = true;
};
EqualHashTable = EqualHashTable;
EqualHashTable.prototype.toWrittenString = function(cache) {
    var keys = this.hash.keys();
    var ret = [];
    for (var i = 0; i < keys.length; i++) {
	    var keyStr = types.toWrittenString(keys[i], cache);
	    var valStr = types.toWrittenString(this.hash.get(keys[i]), cache);
	    ret.push('(' + keyStr + ' . ' + valStr + ')');
    }
    return ('#hash(' + ret.join(' ') + ')');
};
EqualHashTable.prototype.toDisplayedString = EqualHashTable.prototype.toWrittenString;
EqualHashTable.prototype.toDomNode = function(cache) {
	var wrapper = document.createElement("span"),
		hashSymbol = document.createElement("span"),
    	keys = this.hash.keys(),
    	ariaText = "hashtable with "+keys.length + " item"+(keys.length==1? "" : "s")+": ";
    wrapper.appendChild(document.createTextNode(this.toDisplayedString()));
    for (var i = 0; i < keys.length; i++) {
	    var keyDom = toDomNode(keys[i], cache);
	    var valDom = toDomNode(this.hash.get(keys[i]), cache);
	    ariaText += " "+keyDom.ariaText+" maps to "+valDom.ariaText;
    }
    wrapper.ariaText = ariaText;
    wrapper.setAttribute("aria-label", ariaText);
    return wrapper;
};
EqualHashTable.prototype.isEqual = function(other, aUnionFind) {
    if ( !(other instanceof EqualHashTable) ) {
		return false; 
    }
    if (this.hash.keys().length != other.hash.keys().length) { 
		return false;
    }
    var keys = this.hash.keys();
    for (var i = 0; i < keys.length; i++){
		if (! (other.hash.containsKey(keys[i]) &&
		       isEqual(this.hash.get(keys[i]),
			       other.hash.get(keys[i]),
			       aUnionFind))) {
		    return false;
		}
    }
    return true;
};

//////////////////////////////////////////////////////////////////////
// Boxes
var Box = function(x, mutable) {
	this.val = x;
	this.mutable = mutable;
};
Box.prototype.unbox = function() {
    return this.val;
};
Box.prototype.set = function(newVal) {
    if (this.mutable) {
	    this.val = newVal;
    }
};
Box.prototype.toString = function() {
    return "#&" + this.val.toString();
};
Box.prototype.toWrittenString = function(cache) {
    return "#&" + toWrittenString(this.val, cache);
};
Box.prototype.toDisplayedString = this.toWrittenString;
Box.prototype.toDomNode = function(cache) {
    var wrapper = document.createElement("span"),
    boxSymbol = document.createElement("span");
    boxSymbol.appendChild(document.createTextNode("#&"));
    var ariaText = "a box containing: "+toDomNode(this.val).ariaText;
    wrapper.className = "wescheme-box";
	wrapper.ariaText = ariaText;
	wrapper.setAttribute("aria-label", ariaText);
    wrapper.appendChild(boxSymbol);
    wrapper.appendChild(toDomNode(this.val, cache));
    return wrapper;
};

//////////////////////////////////////////////////////////////////////
// Booleans
// We are reusing the built-in Javascript boolean class here.
Logic = {
    TRUE : true,
    FALSE : false
};
// WARNING: we are extending the built-in Javascript boolean class here!
Boolean.prototype.toString = function() { return this.valueOf() ? "true" : "false"; };
Boolean.prototype.toWrittenString = Boolean.prototype.toString
Boolean.prototype.toDisplayedString = Boolean.prototype.toString;
Boolean.prototype.toDomNode = function() {
	return simpleToDomNode( this.toString(), 
							"wescheme-boolean", 
							this.toString() + ", a Boolean");
};
Boolean.prototype.isEqual = function(other, aUnionFind){
    return this == other;
};

//////////////////////////////////////////////////////////////////////
// Chars
// Char: string -> Char
Char = function(val){
    this.val = val;
};
Char.makeInstance = function(val){
    return new Char(val);
};
Char.prototype.toString = function() {
	var code = this.val.charCodeAt(0);
	var returnVal;
	switch (code) {
		case 0: returnVal = '#\\nul'; break;
		case 8: returnVal = '#\\backspace'; break;
		case 9: returnVal = '#\\tab'; break;
		case 10: returnVal = '#\\newline'; break;
		case 11: returnVal = '#\\vtab'; break;
		case 12: returnVal = '#\\page'; break;
		case 13: returnVal = '#\\return'; break;
		case 20: returnVal = '#\\space'; break;
		case 127: returnVal = '#\\rubout'; break;
		default: if (code >= 32 && code <= 126) {
				 returnVal = ("#\\" + this.val);
			 }
			 else {
				 var numStr = code.toString(16).toUpperCase();
				 while (numStr.length < 4) {
					 numStr = '0' + numStr;
				 }
				 returnVal = ('#\\u' + numStr);
			 }
			 break;
	}
	return returnVal;
};
Char.prototype.toWrittenString = Char.prototype.toString;
Char.prototype.toDisplayedString = function (cache) {
    return this.val;
};
Char.prototype.toDomNode = function() {
	return simpleToDomNode( this.toString(), 
							"wescheme-character", 
							this.toString().substring(2) + ", a Character");
}
Char.prototype.getValue = function() {
    return this.val;
};
Char.prototype.isEqual = function(other, aUnionFind){
    return other instanceof Char && this.val == other.val;
};

////////////////////////////////////////////////////////////////////// 
// Symbols
var Symbol = function(val) {
    this.val = val;
};
var symbolCache = {};
  
// makeInstance: string -> Symbol.
Symbol.makeInstance = function(val) {
    // To ensure that we can eq? symbols with equal values.
    if (!(hasOwnProperty.call(symbolCache, val))) {
		symbolCache[val] = new Symbol(val);
    }
    return symbolCache[val];
}; 
Symbol.prototype.isEqual = function(other, aUnionFind) {
    return other instanceof Symbol &&
    this.val == other.val;
};
Symbol.prototype.toString = function() {
    return this.val;
};
Symbol.prototype.toWrittenString = function(cache) {
    return this.val;
};
Symbol.prototype.toDisplayedString = this.toWrittenString;
Symbol.prototype.toDomNode = function(cache) {
	var dom = simpleToDomNode(this.toString(), 
							"wescheme-symbol", 
							"'"+this.val + ", a Symbol");
    dom.style.fontFamily = 'monospace';
    dom.style.whiteSpace = "pre";
    return dom;
};

//////////////////////////////////////////////////////////////////////
// Cons, Lists and Empty    
Empty = function() {};
Empty.EMPTY = new Empty();
Empty.prototype.isEqual = function(other, aUnionFind) {
    return other instanceof Empty;
};
Empty.prototype.reverse = function() {
    return this;
};
Empty.prototype.first = function() {
    throw new Error("first can't be applied on empty.");
};
Empty.prototype.rest = function() {
    throw new Error("rest can't be applied on empty.");
};
Empty.prototype.isEmpty = function() {
    return true;
};
Empty.prototype.toWrittenString = function(cache) { return "empty"; };
Empty.prototype.toDisplayedString = this.toWrittenString;
Empty.prototype.toString = function(cache) { return "()"; }; 
Empty.prototype.toDomNode = function(cache) { 
	var wrapper = document.createElement("span");
	var dom = simpleToDomNode("empty", "wescheme-symbol", "empty");
    dom.style.fontFamily = 'monospace';
    dom.style.whiteSpace = "pre";
    return dom;
};

// Empty.append: (listof X) -> (listof X)
Empty.prototype.append = function(b){
    return b;
};
Cons = function(f, r) {
    this.f = f;
    this.r = r;
};
Cons.prototype.reverse = function() {
    var lst = this;
    var ret = Empty.EMPTY;
    while (!lst.isEmpty()){
		ret = Cons.makeInstance(lst.first(), ret);
		lst = lst.rest();
    }
    return ret;
};
Cons.makeInstance = function(f, r) {
    return new Cons(f, r);
};
// FIXME: can we reduce the recursion on this?
Cons.prototype.isEqual = function(other, aUnionFind) {
    if (! (other instanceof Cons)) {
		return Logic.FALSE;
    }
    return (isEqual(this.first(), other.first(), aUnionFind) &&
	    	isEqual(this.rest(), other.rest(), aUnionFind));
};
Cons.prototype.first = function() {
    return this.f;
};  
Cons.prototype.rest = function() {
    return this.r;
};  
Cons.prototype.isEmpty = function() {
    return false;
};  
// Cons.append: (listof X) -> (listof X)
Cons.prototype.append = function(b){
    if (b === Empty.EMPTY)
	return this;
    var ret = b;
    var lst = this.reverse();
    while ( !lst.isEmpty() ) {
		ret = Cons.makeInstance(lst.first(), ret);
		lst = lst.rest();
    }
	
    return ret;
};
Cons.prototype.toWrittenString = function(cache) {
    //    cache.put(this, true);
    var texts = ["list"];
    var p = this;
    while ( p instanceof Cons ) {
		texts.push(toWrittenString(p.first(), cache));
		p = p.rest();
    }
    if ( p !== Empty.EMPTY ) {
		// If not a list, we've got to switch over to cons pair
		// representation.
		return explicitConsString(this, cache, toWrittenString);
    }
    return "(" + texts.join(" ") + ")";
};
var explicitConsString = function(p, cache, f) {
    var texts = [];
    var tails = []
    while ( p instanceof Cons ) {
		texts.push("(cons ");
		texts.push(f(p.first(), cache));
		texts.push(" ");
		tails.push(")");
		p = p.rest();
    }
    texts.push(f(p, cache));
    return (texts.join("") + tails.join(""));
};
Cons.prototype.toString = Cons.prototype.toWrittenString;
Cons.prototype.toDisplayedString = this.toWrittenString;
Cons.prototype.toDomNode = function(cache) {
    //    cache.put(this, true);
    var node = document.createElement("span"),
        abbr = document.createElement("span");
    node.className = "wescheme-cons";
    abbr.appendChild(document.createTextNode("list"));
 
    node.appendChild(makeLParen());
    node.appendChild(abbr);
    var p = this, i = 0, ariaElts = "";
    while ( p instanceof Cons ) {
    	var dom = toDomNode(p.first(), cache);
    	node.appendChild(dom);
    	i++;
		ariaElts += ", " + dom.ariaText || dom.textContent;
    	p = p.rest();
    }
    if ( p !== Empty.EMPTY ) {
		return explicitConsDomNode(this, cache);
    }
 	node.appendChild(makeRParen());
 	var ariaText = "list of "+i+ " element"+(i==1? "" : "s")+": "+ariaElts;
 	node.setAttribute("aria-label", ariaText);
 	node.ariaText = ariaText;
    return node;
};
var explicitConsDomNode = function(p, cache) {
    var topNode = document.createElement("span");
    var node = topNode, constructor = document.createElement("span");
       	constructor.appendChild(document.createTextNode("cons")),
       	ariaText = "", trailingRParens="";

    node.className = "wescheme-cons";
    while ( p instanceof Cons ) {
      node.appendChild(makeLParen());
      node.appendChild(constructor.cloneNode(true));
      ariaText += " (cons";
      trailingRParens += ")";
      var first = toDomNode(p.first(), cache);
      ariaText += " " + first.ariaText || first.textContent;
      node.appendChild(first);
      var restSpan = document.createElement("span");
      node.appendChild(restSpan);
      node.appendChild(makeRParen());
      node = restSpan;
      p = p.rest();
    }
    var rest = toDomNode(p, cache);
    ariaText += " " + (rest.ariaText || rest.textContent) + ")"+trailingRParens;
    node.appendChild(rest);
    topNode.ariaText = ariaText;
    topNode.setAttribute("aria-label", ariaText);
    return topNode;
};

//////////////////////////////////////////////////////////////////////
// Vectors
Vector = function(n, initialElements) {
    this.elts = new Array(n);
    if (initialElements) {
		for (var i = 0; i < n; i++) {
		    this.elts[i] = initialElements[i];
		}
    } else {
		for (var i = 0; i < n; i++) {
		    this.elts[i] = undefined;
		}
    }
    this.mutable = true;
};
Vector.makeInstance = function(n, elts) {
    return new Vector(n, elts);
}
Vector.prototype.length = function() {
	return this.elts.length;
};
Vector.prototype.ref = function(k) {
    return this.elts[k];
};
Vector.prototype.set = function(k, v) {
    this.elts[k] = v;
};
Vector.prototype.isEqual = function(other, aUnionFind) {
    if (other != null && other != undefined && other instanceof Vector) {
		if (other.length() != this.length()) {
		    return false
		}
		for (var i = 0; i <  this.length(); i++) {
		    if (! isEqual(this.elts[i], other.elts[i], aUnionFind)) {
			return false;
		    }
		}
		return true;
    } else {
		return false;
    }
};

Vector.prototype.toList = function() {
    var ret = Empty.EMPTY;
    for (var i = this.length() - 1; i >= 0; i--) {
		ret = Cons.makeInstance(this.elts[i], ret);	    
    }	
    return ret;
};
Vector.prototype.toWrittenString = function(cache) {
    //    cache.put(this, true);
    var texts = [];
    for (var i = 0; i < this.length(); i++) {
		texts.push(toWrittenString(this.ref(i), cache));
    }
    return "#(" + texts.join(" ") + ")";
};
Vector.prototype.toDisplayedString = this.toWrittenString;
Vector.prototype.toDomNode = function(cache) {
    var wrapper = document.createElement("span"),
        lVect = document.createElement("span"),
        rVect = document.createElement("span");
    lVect.appendChild(document.createTextNode("#("));
    lVect.className = "lParen";
    rVect.appendChild(document.createTextNode(")"));
    rVect.className = "rParen";
    wrapper.className = "wescheme-vector";
    wrapper.appendChild(lVect);
    var ariaText = "a vector of size "+this.length() + ": ";
    for (var i = 0; i < this.length(); i++) {
    	var dom = toDomNode(this.ref(i), cache)
    	ariaText+=" "+dom.ariaText
    	wrapper.appendChild(dom);
    }
    wrapper.appendChild(rVect);
    wrapper.setAttribute("aria-label", ariaText);
    wrapper.ariaText = ariaText;
    return wrapper;
};

//////////////////////////////////////////////////////////////////////
// Strings
var Str = function(chars) {
	this.chars = chars;
	this.length = chars.length;
	this.mutable = true;
}
Str.makeInstance = function(chars) {
	return new Str(chars);
}
Str.fromString = function(s) {
	return Str.makeInstance(s.split(""));
}
Str.prototype.toString = function() {
	return this.chars.join("");
}
Str.prototype.toWrittenString = function(cache) {
    return escapeString(this.toString());
}
Str.prototype.toDisplayedString = Str.prototype.toString;
Str.prototype.copy = function() {
	return Str.makeInstance(this.chars.slice(0));
}
Str.prototype.substring = function(start, end) {
	if (end == null || end == undefined) {
		end = this.length;
	}	
	return Str.makeInstance( this.chars.slice(start, end) );
}
Str.prototype.charAt = function(index) {
	return this.chars[index];
}
Str.prototype.charCodeAt = function(index) {
	return this.chars[index].charCodeAt(0);
}
Str.prototype.replace = function(expr, newStr) {
	return Str.fromString( this.toString().replace(expr, newStr) );
}
Str.prototype.isEqual = function(other, aUnionFind) {
	if ( !(other instanceof Str || typeof(other) == 'string') ) {
		return false;
	}
	return this.toString() === other.toString();
}
Str.prototype.set = function(i, c) {
	this.chars[i] = c;
}
Str.prototype.toUpperCase = function() {
	return Str.fromString( this.chars.join("").toUpperCase() );
}
Str.prototype.toLowerCase = function() {
	return Str.fromString( this.chars.join("").toLowerCase() );
}
Str.prototype.match = function(regexpr) {
	return this.toString().match(regexpr);
}
var escapeString = function(s) {
    return '"' + replaceUnprintableStringChars(s) + '"';
};
var replaceUnprintableStringChars = function(s) {
	var ret = [];
	for (var i = 0; i < s.length; i++) {
		var val = s.charCodeAt(i);
		switch(val) {
			case 7: ret.push('\\a'); break;
			case 8: ret.push('\\b'); break;
			case 9: ret.push('\\t'); break;
			case 10: ret.push('\\n'); break;
			case 11: ret.push('\\v'); break;
			case 12: ret.push('\\f'); break;
			case 13: ret.push('\\r'); break;
			case 34: ret.push('\\"'); break;
			case 92: ret.push('\\\\'); break;
			default: if (val >= 32 && val <= 126) {
					 ret.push( s.charAt(i) );
				 }
				 else {
					 var numStr = val.toString(16).toUpperCase();
					 while (numStr.length < 4) {
						 numStr = '0' + numStr;
					 }
					 ret.push('\\u' + numStr);
				 }
				 break;
		}
	}
	return ret.join('');
};

//////////////////////////////////////////////////////////////////////
// Native JS-objects
var JsObject = function(name, obj) {
	this.name = name;
	this.obj = obj;
};
JsObject.prototype.toString = function() {
	return '#<js-object:' + typeof(this.obj) + ':' + this.name + '>';
};
JsObject.prototype.isEqual = function(other, aUnionFind) {
	return (this.obj === other.obj);
};

//////////////////////////////////////////////////////////////////////
// World Configs
var WorldConfig = function(startup, shutdown, args) {
	this.startup = startup;
	this.shutdown = shutdown;
	this.startupArgs = args;
	this.shutdownArg = undefined;
};
WorldConfig.prototype.toString = function() {
	return '#<world-config>';
};
WorldConfig.prototype.isEqual = function(other, aUnionFind) {
	if ( ! isEqual(this.startup, other.startup, aUnionFind) ||
	     ! isEqual(this.shutdown, other.shutdown, aUnionFind) ||
	     this.startupArgs.length != other.startupArgs.length || 
	     ! isEqual(this.shutdownArg, other.shutdownArg, aUnionFind) ) {
		return false;
	}

	for (var i = 0; i < args.length; i++) {
		if ( !isEqual(this.startupArgs[i], other.startupArgs[i], aUnionFind) )
			return false;
	}
	return true;
};
var Effect = makeStructureType('effect', false, 0, 0, false, false);
Effect.type.prototype.invokeEffect = function(k) {
	helpers.raise(types.incompleteExn(
			types.exnFail,
			'effect type created without using make-effect-type',
			[]));
};
var makeEffectType = function(name, superType, initFieldCnt, impl, guard, caller) {
	if ( !superType ) {
		superType = Effect;
	}
	
	var newType = makeStructureType(name, superType, initFieldCnt, 0, false, guard);
	var lastFieldIndex = newType.firstField + newType.numberOfFields;

	newType.type.prototype.invokeEffect = function(changeWorld, k) {
		var schemeChangeWorld = new PrimProc('update-world', 1, false, true,
			function(aState, worldUpdater) {
				helpers.check(aState, worldUpdater, helpers.procArityContains(1),
					      'update-world', 'procedure (arity 1)', 1);
				
				changeWorld(function(w, k2) { interpret.call(aState,
									     worldUpdater, [w],
									     k2,
									     function(e) { throw e; }); },
					    function() { aState.v = VOID_VALUE; });
			});

		var args = this._fields.slice(0, lastFieldIndex);
		args.unshift(schemeChangeWorld);
		caller(impl, args, k);
	}

	return newType;
};
var RenderEffect = makeStructureType('render-effect', false, 0, 0, false, false);
RenderEffect.type.prototype.callImplementation = function(caller, k) {
	helpers.raise(types.incompleteExn(
			types.exnFail,
			'render effect created without using make-render-effect-type',
			[]));
};
var makeRenderEffectType = function(name, superType, initFieldCnt, impl, guard) {
	if ( !superType ) {
		superType = RenderEffect;
	}
	
	var newType = makeStructureType(name, superType, initFieldCnt, 0, false, guard);
	var lastFieldIndex = newType.firstField + newType.numberOfFields;

	newType.type.prototype.callImplementation = function(caller, k) {
		var args = this._fields.slice(0, lastFieldIndex);
		caller(impl, args, k);
	}
	return newType;
};

//////////////////////////////////////////////////////////////////////
// generic, top-level description functions
var toWrittenString = function(x, cache) {
    if (! cache) { 
     	cache = makeLowLevelEqHash();
    }

    if (typeof(x) == 'object') {
	    if (cache.containsKey(x)) {
		    return "...";
	    } else {
	        cache.put(x, true);
            }
    }

    if (x == undefined || x == null) {
		return "#<undefined>";
    }
    if (typeof(x) == 'string') {
		return escapeString(x.toString());
    }
    if (typeof(x) != 'object' && typeof(x) != 'function') {
		return x.toString();
    }

    var returnVal;
    if (typeof(x.toWrittenString) !== 'undefined') {
		returnVal = x.toWrittenString(cache);
    } else if (typeof(x.toDisplayedString) !== 'undefined') {
		returnVal = x.toDisplayedString(cache);
    } else {
		returnVal = x.toString();
    }
    cache.remove(x);
    return returnVal;
};

var toDisplayedString = function(x, cache) {
    if (! cache) {
    	cache = makeLowLevelEqHash();
    }

    if (typeof(x) == 'object') {
	    if (cache.containsKey(x)) {
		    return "...";
	    }
	    cache.put(x, true);
    }

    if (x == undefined || x == null) {
		return "#<undefined>";
    }
    if (typeof(x) == 'string') {
		return x;
    }
    if (typeof(x) != 'object' && typeof(x) != 'function') {
		return x.toString();
    }

    var returnVal;
    if (typeof(x.toDisplayedString) !== 'undefined') {
		returnVal = x.toDisplayedString(cache);
    } else if (typeof(x.toWrittenString) !== 'undefined') {
		returnVal = x.toWrittenString(cache);
    } else {
		returnVal = x.toString();
    }
    cache.remove(x);
    return returnVal;
};



// toDomNode: scheme-value -> dom-node
var toDomNode = function(x, cache) {
    if (! cache) {
    	cache = makeLowLevelEqHash();
    }
    // try using the value's native toDomNode method, if it exists
    if(typeof(x.toDomNode) !== 'undefined') {
    	return x.toDomNode(cache);
    }
    // Not all numbers have it, so use a special toDomNode
    if (isNumber(x)) {
		return numberToDomNode(x);
    }
    // Deal with unknown objects differently
    if (typeof(x) == 'object') {
	    if (cache.containsKey(x)) {
        var node = document.createElement("span");
        node.style['font-family'] = 'monospace';
        node.appendChild(document.createTextNode("..."));
        return node;
	    }
	    cache.put(x, true);
    }
    // Deal with js-null and js-undefined differently
    if (x == undefined || x == null) {
      var node = document.createElement("span");
      node.style['font-family'] = 'monospace';
      node.appendChild(document.createTextNode("#<undefined>"));
      return node;
    }
    // Deal with strings differently
    if (typeof(x) == 'string') {
        return textToDomNode(toWrittenString(x));
    }
    if (typeof(x) != 'object' && typeof(x) != 'function') {
        return textToDomNode(x.toString());
    }

    // See if we can find something useful from toWrittenString or toDisplayedString
    var returnVal;
    if (x.nodeType) {
		returnVal =  x;
    } else if (typeof(x.toWrittenString) !== 'undefined') {	
        returnVal = textToDomNode(x.toWrittenString(cache))
    } else if (typeof(x.toDisplayedString) !== 'undefined') {
        returnVal = textToDomNode(x.toDisplayedString(cache));
    } else {
        returnVal = textToDomNode(x.toString());
    }
    cache.remove(x);
    return returnVal;
};

// from http://stackoverflow.com/questions/17267329/converting-unicode-character-to-string-format
function unicodeToChar(text) {
   return text.replace(/\\u[\dABCDEFabcdef][\dABCDEFabcdef][\dABCDEFabcdef][\dABCDEFabcdef]/g, 
          function (match) {
               return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
          });
}

var textToDomNode = function(text) {
    var rawChunks = text.split("\n");
    var displayedChunks = rawChunks.map(unicodeToChar);
    var i;
    var wrapper = document.createElement("span");
    var displayedString = document.createElement("span");
    var rawString = document.createElement("span");
    rawString.style.paddingLeft = displayedString.style.paddingLeft = "0px";
    var newlineDiv;
    if (rawChunks.length > 0) {
        displayedString.appendChild(document.createTextNode(displayedChunks[0]));
        rawString.appendChild(document.createTextNode(rawChunks[0]));
    }
    for (i = 1; i < rawChunks.length; i++) {
        newlineDiv = document.createElement("br");
        newlineDiv.style.clear = 'left';
        displayedString.appendChild(newlineDiv);
        displayedString.appendChild(document.createTextNode(displayedChunks[i]));
        rawString.appendChild(document.createTextNode(rawChunks[i]));
    }
    wrapper.className = "wescheme-string";
    var ariaText = displayedChunks.join(" ") +  ", a String";
    wrapper.ariaText = ariaText;
    wrapper.setAttribute("aria-label", ariaText);
    wrapper.style.fontFamily = 'monospace';
    wrapper.style.whiteSpace = "pre-wrap";
    wrapper.appendChild(rawString);
    // if the text isn't pure ASCII, make a toggleable node 
    if(text !== unicodeToChar(text)) {
	    wrapper.appendChild(displayedString);
	    var showingDisplayedString = true;
	    rawString.style.display = 'none';
	    wrapper.onclick = function(e) {
			showingDisplayedString = !showingDisplayedString;
			rawString.style.display = (!showingDisplayedString ? 'inline' : 'none')
			displayedString.style.display = (showingDisplayedString ? 'inline' : 'none');
	    };
	    wrapper.style['cursor'] = 'pointer';
	}
    return wrapper;
};

// numberToDomNode: jsnum -> dom
// Given a jsnum, produces a dom-node representation.
var numberToDomNode = function(n) {
    var className, ariaText = n.toString();
    if (jsnums.isExact(n)) {
      if (jsnums.isInteger(n)) {
          className = "wescheme-number Integer";
          ariaText += "";
      } else if (jsnums.isRational(n)) {
          node = rationalToDomNode(n);
          className = node.className;
          ariaText = node.ariaText + ", Rational";
          return node;
      } else if (isComplex(n)) {
          className = "wescheme-number Complex";
          ariaText += ", Complex Number";
      } else {
          ariaText += ", Number";
      }
    } else {
    	if (isComplex(n)) {
          className = " wescheme-numberComplex";
          ariaText += ", a Complex Number";
      	} else {
      		ariaText += ", a Number";
      	}
    }
    return simpleToDomNode(n.toString(), className, ariaText);
};

// rationalToDomNode: rational -> dom-node
var rationalToDomNode = function(n) {
    var repeatingDecimalNode = document.createElement("span");
    var chunks = jsnums.toRepeatingDecimal(jsnums.numerator(n),
					   jsnums.denominator(n),
					   {limit: 25});
    var firstPart = document.createElement("span");
    firstPart.appendChild(document.createTextNode(chunks[0] + '.' + chunks[1]));
    repeatingDecimalNode.appendChild(firstPart);
    repeatingDecimalNode.ariaText = chunks[0] + ' point ' + chunks[1];
    if (chunks[2] === '...') {
      firstPart.appendChild(document.createTextNode(chunks[2]));
      repeatingDecimalNode.ariaText += " , (truncated)";
    } else if (chunks[2] !== '0') {
      var overlineSpan = document.createElement("span");
      overlineSpan.style.textDecoration = 'overline';
      overlineSpan.appendChild(document.createTextNode(chunks[2]));
      repeatingDecimalNode.appendChild(overlineSpan);
      repeatingDecimalNode.ariaText += (chunks[1]? " with repeating "+chunks[2] : chunks[2]+" repeating");
    }
    repeatingDecimalNode.setAttribute('aria-hidden', true);

    var fractionalNode = document.createElement("span");
    var numeratorNode = document.createElement("sup");
    numeratorNode.appendChild(document.createTextNode(String(jsnums.numerator(n))));
    var denominatorNode = document.createElement("sub");
    denominatorNode.appendChild(document.createTextNode(String(jsnums.denominator(n))));
    var barNode = document.createElement("span");
    barNode.appendChild(document.createTextNode("/"));

    fractionalNode.appendChild(numeratorNode);
    fractionalNode.appendChild(barNode);
    fractionalNode.appendChild(denominatorNode);
    fractionalNode.ariaText = String(jsnums.numerator(n))+" over "+String(jsnums.denominator(n));

    
    var numberNode = document.createElement("span");
    numberNode.appendChild(repeatingDecimalNode);
    numberNode.appendChild(fractionalNode);
    fractionalNode.style['display'] = 'none';
    fractionalNode.setAttribute('aria-hidden', true);

    var showingRepeating = true;

    numberNode.onclick = function(e) {
		showingRepeating = !showingRepeating;
		repeatingDecimalNode.style['display'] = (showingRepeating ? 'inline' : 'none');
		fractionalNode.style['display'] = (!showingRepeating ? 'inline' : 'none');
		numberNode.setAttribute('aria-label', (showingRepeating? repeatingDecimalNode : fractionalNode).ariaText);
    };
    numberNode.ariaText = repeatingDecimalNode.ariaText;
    numberNode.style['cursor'] = 'pointer';
    numberNode.className = "wescheme-number Rational";
    
    return numberNode;
};

var isNumber = jsnums.isSchemeNumber;
var isComplex = function(n) {return n instanceof jsnums.Complex; };
var isString = function(s) {
	return (typeof s === 'string' || s instanceof Str);
}

// isEqual: X Y -> boolean
// Returns true if the objects are equivalent; otherwise, returns false.
var isEqual = function(x, y, aUnionFind) {
    if (x === y) { return true; }

    if (isNumber(x) && isNumber(y)) {
	return jsnums.equals(x, y);
    }

    if (isString(x) && isString(y)) {
	return x.toString() === y.toString();
    }

    if (x == undefined || x == null) {
	return (y == undefined || y == null);
    }

    if ( typeof(x) == 'object' &&
	 typeof(y) == 'object' &&
	 x.isEqual &&
	 y.isEqual) {
	if (aUnionFind.find(x) === aUnionFind.find(y)) {
	    return true;
	}
	else {
	    aUnionFind.merge(x, y); 
	    return x.isEqual(y, aUnionFind);
	}
    }
    return false;
};


// liftToplevelToFunctionValue: primitive-function string fixnum scheme-value -> scheme-value
// Lifts a primitive toplevel or module-bound value to a scheme value.
var liftToplevelToFunctionValue = function(primitiveF,
				       name,
				       minArity, 
				       procedureArityDescription) {
    if (! primitiveF._mobyLiftedFunction) {
	var lifted = function(args) {
	    return primitiveF.apply(null, args.slice(0, minArity).concat([args.slice(minArity)]));
	};
	lifted.isEqual = function(other, cache) { 
	    return this === other; 
	}
	lifted.toWrittenString = function(cache) { 
	    return "#<function:" + name + ">";
	};
	lifted.toDomNode = function() {
		return simpleToDomNode(this.toWrittenString(), "wescheme-primproc", name + ", a function");
	};
	lifted.toDisplayedString = lifted.toWrittenString;
	lifted.procedureArity = procedureArityDescription;
	primitiveF._mobyLiftedFunction = lifted;
	    
    } 
    return primitiveF._mobyLiftedFunction;
};



//////////////////////////////////////////////////////////////////////
var ThreadCell = function(v, isPreserved) {
    this.v = v;
    this.isPreserved = isPreserved || false;
};



//////////////////////////////////////////////////////////////////////
// Wrapper around functions that return multiple values.
var ValuesWrapper = function(elts) {
    this.elts = elts;
};

ValuesWrapper.prototype.toDomNode = function(cache) {
    var parent = document.createElement("span");
    parent.style.whiteSpace = "pre";
    var ariaText = "Value Wrapper with "+this.elts.length
    	+ "element"+(this.elts.length===1? "" : "s")+":";
    if ( this.elts.length > 0 ) {
	    parent.appendChild( toDomNode(this.elts[0], cache) );
	    for (var i = 1; i < this.elts.length; i++) {
	    	var dom = toDomNode(this.elts[i], cache);
		    parent.appendChild( document.createTextNode('\n') );
		    parent.appendChild(dom);
		    ariaText += " "+ dom.ariaText || dom.textContent;
	    }
    }
    return parent;
};


var UndefinedValue = function() {
};
UndefinedValue.prototype.toString = function() {
    return "#<undefined>";
};
var UNDEFINED_VALUE = new UndefinedValue();

var VoidValue = function() {};
VoidValue.prototype.toString = function() {
	return "#<void>";
};
var VOID_VALUE = new VoidValue();

var EofValue = function() {};
EofValue.prototype.toString = function() {
	return "#<eof>";
}
var EOF_VALUE = new EofValue();
var ClosureValue = function(name, locs, numParams, paramTypes, isRest, closureVals, body) {
    this.name = name;
    this.locs = locs;
    this.numParams = numParams;
    this.paramTypes = paramTypes;
    this.isRest = isRest;
    this.closureVals = closureVals;
    this.body = body;
};

ClosureValue.prototype.toString = function() {
    if (this.name !== Empty.EMPTY) {
		return helpers.format("#<function:~a>", [this.name]);
    } else {
		return "#<function>";
    }
};
ClosureValue.prototype.toDomNode = function () {
	return simpleToDomNode(this.toString(), "wescheme-primproc", 
		this.name === Empty.EMPTY? "anonymous function" : this.name + ", a function");
};
var CaseLambdaValue = function(name, closures) {
    this.name = name;
    this.closures = closures;
};
CaseLambdaValue.prototype.toString = function() {
    if (this.name !== Empty.EMPTY) {
		return helpers.format("#<case-lambda-procedure:~a>", [this.name]);
    } else {
		return "#<case-lambda-procedure>";
    }
};
var ContinuationClosureValue = function(vstack, cstack) {
    this.name = false;
    this.vstack = vstack.slice(0);
    this.cstack = cstack.slice(0);
};

ContinuationClosureValue.prototype.toString = function() {
    if (this.name !== Empty.EMPTY) {
		return helpers.format("#<function:~a>", [this.name]);
    } else {
		return "#<function>";
    }
};
ContinuationClosureValue.prototype.toDomNode = function () {
	return simpleToDomNode(this.toWrittenString(), "wescheme-primproc", 
		this.name === Empty.EMPTY? "anonymous function" : this.name + ", a function");
};
//////////////////////////////////////////////////////////////////////
var PrefixValue = function() {
    this.slots = [];
    this.definedMask = [];
};
PrefixValue.prototype.addSlot = function(v) {
    if (v === undefined) { 
		this.slots.push(types.UNDEFINED);
		this.definedMask.push(false);
    } else {
        this.slots.push(v);
		if (v instanceof GlobalBucket) {
		    if (v.value === types.UNDEFINED) {
				this.definedMask.push(false);
		    } else {
				this.definedMask.push(true);
		    }
		} else {
		    this.definedMask.push(true);
		}
    }
};
PrefixValue.prototype.ref = function(n, srcloc) {
    if (this.slots[n] instanceof GlobalBucket) {
    	if (this.definedMask[n]) {
    	    return this.slots[n].value;
    	} else {
    	    helpers.raise(types.incompleteExn(
    			types.exnFailContractVariable,
    			new Message([new ColoredPart(this.slots[n].name, srcloc),
                            ": this variable is not defined"]),
    			[this.slots[n].name]));
    	}
    } else {
    	if (this.definedMask[n]) {
    	    return this.slots[n];
    	} else {
    	    helpers.raise(types.incompleteExn(
    			types.exnFailContractVariable,
    			"variable has not been defined",
    			[false]));
    	}
    }
};

PrefixValue.prototype.set = function(n, v) {
    if (this.slots[n] instanceof GlobalBucket) {
	this.slots[n].value = v;
	this.definedMask[n] = true;
    } else {
	this.slots[n] = v;
	this.definedMask[n] = true;
    }
};
PrefixValue.prototype.length = function() { 
    return this.slots.length;
};
var GlobalBucket = function(name, value) {
    this.name = name;
    this.value = value;
};
var ModuleVariableRecord = function(resolvedModuleName,
				    variableName) {
    this.resolvedModuleName = resolvedModuleName;
    this.variableName = variableName;
};

//////////////////////////////////////////////////////////////////////
// Variable Reference
var VariableReference = function(prefix, pos) {
    this.prefix = prefix;
    this.pos = pos;
};
VariableReference.prototype.ref = function() {
    return this.prefix.ref(this.pos);
};
VariableReference.prototype.set = function(v) {
    this.prefix.set(this.pos, v);
}

//////////////////////////////////////////////////////////////////////
// Continuation Marks
var ContMarkRecordControl = function(dict) {
    this.dict = dict || {};
};
ContMarkRecordControl.prototype.invoke = function(state) {
    // No-op: the record will simply pop off the control stack.
};
ContMarkRecordControl.prototype.update = function(key, val) {
 this.dict[key.val] = val;
  return this;
};
var ContinuationMarkSet = function(dict) {
    this.dict = dict;
}
ContinuationMarkSet.prototype.toDomNode = function(cache) {
    var dom = document.createElement("span");
    dom.appendChild(document.createTextNode('#<continuation-mark-set>'));
    return dom;
};
ContinuationMarkSet.prototype.toWrittenString = function(cache) {
    return '#<continuation-mark-set>';
};
ContinuationMarkSet.prototype.toDisplayedString = this.toWrittenString;
ContinuationMarkSet.prototype.ref = function(key) {
    if ( this.dict.containsKey(key) ) {
	    return this.dict.get(key);
    }
    return [];
};

//////////////////////////////////////////////////////////////////////
// Continuation Prompt
var ContinuationPrompt = function() {
};
var defaultContinuationPrompt = new ContinuationPrompt();

//////////////////////////////////////////////////////////////////////
// Primitive Procedure
var PrimProc = function(name, numParams, isRest, assignsToValueRegister, impl) {
    this.name = name;
    this.numParams = numParams;
    this.isRest = isRest;
    this.assignsToValueRegister = assignsToValueRegister;
    this.impl = impl;
};
PrimProc.prototype.toString = function() {
    return ("#<function:" + this.name + ">");
};
PrimProc.prototype.toWrittenString = PrimProc.prototype.toString;
PrimProc.prototype.toDisplayedString = PrimProc.prototype.toString;
PrimProc.prototype.toDomNode = function(cache) {
    return simpleToDomNode(this.toString(), "wescheme-primproc", this.name + ", a function");
};
//////////////////////////////////////////////////////////////////////
// Case Primitive
var CasePrimitive = function(name, cases) {
    this.name = name;
    this.cases = cases;
};

CasePrimitive.prototype.toString = function(cache) {
    return ("#<function:" + this.name + ">");
};
CasePrimitive.prototype.toWrittenString = CasePrimitive.prototype.toString;
CasePrimitive.prototype.toDisplayedString = CasePrimitive.prototype.toString;
CasePrimitive.prototype.toDomNode = function(cache) {
    return simpleToDomNode(this.toString(), "wescheme-caseprimitive", this.name + ", a function");
};/////////////////////////////////////////////////////////////////////
// Colored Error Message Support

var Message = function(args) {
  this.args = args;
};

Message.prototype.toString = function() {
  var toReturn = [];
  var i;
  for(i = 0; i < this.args.length; i++) {
      toReturn.push(''+this.args[i]);
  }
  
  return toReturn.join("");
};

var isMessage = function(o) {
  return o instanceof Message;
};

var ColoredPart = function(text, location) {
  this.text = text;
  this.location = location;
};

var isColoredPart = function(o) {
  return o instanceof ColoredPart;
};

ColoredPart.prototype.toString = function() {
    return this.text+'';
};

var GradientPart = function(coloredParts) {
    this.coloredParts = coloredParts;
};

var isGradientPart = function(o) {
  return o instanceof GradientPart;
};

GradientPart.prototype.toString = function() {
	var i;
	var resultArray = [];
	for(i = 0; i < this.coloredParts.length; i++){
		resultArray.push(this.coloredParts[i].text+'');
	}
	return resultArray.join("");

};

var MultiPart = function(text, locations, solid) {
    this.text = text;
    this.locations = locations;
    this.solid = solid;
};

var isMultiPart = function(o) {
  return o instanceof MultiPart;
};

MultiPart.prototype.toString = function() {
	return this.text;
};


//////////////////////////////////////////////////////////////////////
var makeList = function(args) {
    var result = Empty.EMPTY;
    var i;
    for(i = args.length-1; i >= 0; i--) {
	result = Cons.makeInstance(args[i], result);
    }
    return result;
};
var makeVector = function(args) {
    return Vector.makeInstance(args.length, args);
};
var makeString = function(s) {
	if (s instanceof Str) {
		return s;
	}
	else if (s instanceof Array) {
		return Str.makeInstance(s);
	}
	else if (typeof s === 'string') {
		return Str.fromString(s);
	}
	else {
		throw types.internalError('makeString expects and array of 1-character strings or a string;' +
					  ' given ' + s.toString(),
					  false);
	}
};
var makeHashEq = function(lst) {
	var newHash = new EqHashTable();
	while ( !lst.isEmpty() ) {
		newHash.hash.put(lst.first().first(), lst.first().rest());
		lst = lst.rest();
	}
	return newHash;
};
var makeHashEqual = function(lst) {
	var newHash = new EqualHashTable();
	while ( !lst.isEmpty() ) {
		newHash.hash.put(lst.first().first(), lst.first().rest());
		lst = lst.rest();
	}
	return newHash;
};

//if there is not enough location information available,
//this allows for highlighting to be turned off
var NoLocation = makeVector(['<no-location>', 0,0,0,0]);

var isNoLocation = function(o) {
  return o === NoLocation;
};

var Posn = makeStructureType('posn', false, 2, 0, false, false);
var Color = makeStructureType('color', false, 4, 0, false, false);
var ArityAtLeast = makeStructureType('arity-at-least', false, 1, 0, false,
		function(k, n, name) {
			helpers.check(undefined, n, function(x) { return ( jsnums.isExact(x) &&
								jsnums.isInteger(x) &&
								jsnums.greaterThanOrEqual(x, 0) ); },
				      name, 'exact non-negative integer', 1);
			k(n);
		});


types.symbol = Symbol.makeInstance;
types.rational = jsnums.makeRational;
types['float'] = jsnums.makeFloat;
types.complex = jsnums.makeComplex;
types.bignum = jsnums.makeBignum;
types.list = makeList;
types.vector = makeVector;
types['char'] = Char.makeInstance;
types['string'] = makeString;
types.box = function(x) { return new Box(x, true); };
types.boxImmutable = function(x) { return new Box(x, false); };
types.pair = function(x, y) { return Cons.makeInstance(x, y); };
types.hash = makeHashEqual;
types.hashEq = makeHashEq;
types.jsObject = function(name, obj) { return new JsObject(name, obj); };

types.toWrittenString = toWrittenString;
types.toDisplayedString = toDisplayedString;
types.toDomNode = toDomNode;

types.posn = Posn.constructor;
types.posnX = function(psn) { return Posn.accessor(psn, 0); };
types.posnY = function(psn) { return Posn.accessor(psn, 1); };

types.color = function(r, g, b, a) { 
    if (a === undefined) {
        a = 255;
    }
    return Color.constructor(r, g, b, a);
};
types.colorRed = function(x) { return Color.accessor(x, 0); };
types.colorGreen = function(x) { return Color.accessor(x, 1); };
types.colorBlue = function(x) { return Color.accessor(x, 2); };
types.colorAlpha = function(x) { return Color.accessor(x, 3); };

types.arityAtLeast = ArityAtLeast.constructor;
types.arityValue = function(arity) { return ArityAtLeast.accessor(arity, 0); };


types.FALSE = Logic.FALSE;
types.TRUE = Logic.TRUE;
types.EMPTY = Empty.EMPTY;

types.isEqual = isEqual;
types.isNumber = isNumber;
types.isSymbol = function(x) { return x instanceof Symbol; };
types.isChar = function(x) { return x instanceof Char; };
types.isString = isString;
types.isPair = function(x) { return x instanceof Cons; };
types.isVector = function(x) { return x instanceof Vector; };
types.isBox = function(x) { return x instanceof Box; };
types.isHash = function(x) { return (x instanceof EqHashTable ||
				     x instanceof EqualHashTable); };
types.isStruct = function(x) { return x instanceof Struct; };
types.isPosn = Posn.predicate;
types.isArityAtLeast = ArityAtLeast.predicate;
types.isColor = Color.predicate;
types.isFunction = function(x) {
	return (x instanceof PrimProc ||
		x instanceof CasePrimitive ||
		x instanceof ClosureValue ||
		x instanceof CaseLambdaValue ||
		x instanceof ContinuationClosureValue);
};
types.getProcedureType = function(x){
 return (x instanceof PrimProc)? "PrimProc" :
       (x instanceof CasePrimitive)? "CasePrimitive" :
       (x instanceof ClosureValue)? "ClosureValue" :
       (x instanceof CaseLambdaValue)? "CaseLambdaValue" :
       (x instanceof ContinuationClosureValue)? "ContinuationClosureValue" :
       /* else */ false;
};
 
types.isJsObject = function(x) { return x instanceof JsObject; };

types.UnionFind = UnionFind;
types.cons = Cons.makeInstance;

types.UNDEFINED = UNDEFINED_VALUE;
types.VOID = VOID_VALUE;
types.EOF = EOF_VALUE;

types.ValuesWrapper = ValuesWrapper;
types.ClosureValue = ClosureValue;
types.ContinuationPrompt = ContinuationPrompt;
types.defaultContinuationPrompt = defaultContinuationPrompt;
types.ContinuationClosureValue = ContinuationClosureValue;
types.CaseLambdaValue = CaseLambdaValue;
types.PrimProc = PrimProc;
types.CasePrimitive = CasePrimitive;

types.contMarkRecordControl = function(dict) { return new ContMarkRecordControl(dict); };
types.isContMarkRecordControl = function(x) { return x instanceof ContMarkRecordControl; };
types.continuationMarkSet = function(dict) { return new ContinuationMarkSet(dict); };
types.isContinuationMarkSet = function(x) { return x instanceof ContinuationMarkSet; };


types.PrefixValue = PrefixValue;
types.GlobalBucket = GlobalBucket;
types.ModuleVariableRecord = ModuleVariableRecord;
types.VariableReference = VariableReference;

types.Box = Box;
types.ThreadCell = ThreadCell;



types.Class = Class;


types.makeStructureType = makeStructureType;
types.isStructType = function(x) { return x instanceof StructType; };


types.makeLowLevelEqHash = makeLowLevelEqHash;


// Error type exports
var InternalError = function(val, contMarks) {
	this.val = val;
	this.contMarks = (contMarks ? contMarks : false);
}
types.internalError = function(v, contMarks) { return new InternalError(v, contMarks); };
types.isInternalError = function(x) { return x instanceof InternalError; };

var SchemeError = function(val) {
	this.val = val;
}
types.schemeError = function(v) { return new SchemeError(v); };
types.isSchemeError = function(v) { return v instanceof SchemeError; };


var IncompleteExn = function(constructor, msg, otherArgs) {
	this.constructor = constructor;
	this.msg = msg;
	this.otherArgs = otherArgs;
};
types.incompleteExn = function(constructor, msg, args) { return new IncompleteExn(constructor, msg, args); };
types.isIncompleteExn = function(x) { return x instanceof IncompleteExn; };

var Exn = makeStructureType('exn', false, 2, 0, false,
		function(k, msg, contMarks, name) {
			// helpers.check(msg, isString, name, 'string', 1, [msg, contMarks]);
			helpers.check(undefined, contMarks, types.isContinuationMarkSet, name, 'continuation mark set', 2);
			k( new ValuesWrapper([msg, contMarks]) );
		});
types.exn = Exn.constructor;
types.isExn = Exn.predicate;
types.exnMessage = function(exn) { return Exn.accessor(exn, 0); };
types.exnContMarks = function(exn) { return Exn.accessor(exn, 1); };
types.exnSetContMarks = function(exn, v) { Exn.mutator(exn, 1, v); };

// (define-struct (exn:break exn) (continuation))
var ExnBreak = makeStructureType('exn:break', Exn, 1, 0, false,
		function(k, msg, contMarks, cont, name) {
		// FIXME: what type is a continuation here?
//			helpers.check(cont, isContinuation, name, 'continuation', 3);
			k( new ValuesWrapper([msg, contMarks, cont]) );
		});
types.exnBreak = ExnBreak.constructor;
types.isExnBreak = ExnBreak.predicate;
types.exnBreakContinuation = function(exn) {
    return ExnBreak.accessor(exn, 0); };

var ExnFail = makeStructureType('exn:fail', Exn, 0, 0, false, false);
types.exnFail = ExnFail.constructor;
types.isExnFail = ExnFail.predicate;

var ExnFailContract = makeStructureType('exn:fail:contract', ExnFail, 0, 0, false, false);
types.exnFailContract = ExnFailContract.constructor;
types.isExnFailContract = ExnFailContract.predicate;

var ExnFailContractArity = makeStructureType('exn:fail:contract:arity', ExnFailContract, 0, 0, false, false);
types.exnFailContractArity = ExnFailContract.constructor;
types.isExnFailContractArity = ExnFailContract.predicate;

var ExnFailContractVariable = makeStructureType('exn:fail:contract:variable', ExnFailContract, 1, 0, false, false);
types.exnFailContractVariable = ExnFailContract.constructor;
types.isExnFailContractVariable = ExnFailContract.predicate;
types.exnFailContractVariableId = function(exn) { return ExnFailContractVariable.accessor(exn, 0); };

var ExnFailContractDivisionByZero = makeStructureType('exn:fail:contract:division-by-zero', ExnFailContract, 0, 0, false, false);
types.exnFailContractDivisionByZero = ExnFailContractDivisionByZero.constructor;
types.isExnFailContractDivisionByZero = ExnFailContractDivisionByZero.predicate;

var ExnFailContractArityWithPosition = makeStructureType('exn:fail:contract:arity:position', ExnFailContractArity, 1, 0, false, false);
types.exnFailContractArityWithPosition = ExnFailContractArityWithPosition.constructor;
types.isExnFailContractArityWithPosition = ExnFailContractArityWithPosition.predicate;

types.exnFailContractArityWithPositionLocations = function(exn) { return ExnFailContractArityWithPosition.accessor(exn, 0); };


///////////////////////////////////////
// World-specific exports

types.worldConfig = function(startup, shutdown, args) { return new WorldConfig(startup, shutdown, args); };
types.isWorldConfig = function(x) { return x instanceof WorldConfig; };

types.makeEffectType = makeEffectType;
types.isEffectType = function(x) {
	return (x instanceof StructType && x.type.prototype.invokeEffect) ? true : false;
};


types.isEffect = Effect.predicate;
types.makeRenderEffectType = makeRenderEffectType;
types.isRenderEffectType = function(x) {
	return (x instanceof StructType && x.type.prototype.callImplementation) ? true : false;
};
types.isRenderEffect = RenderEffect.predicate;
types.NoLocation = NoLocation;
types.isNoLocation = isNoLocation;
types.ColoredPart = ColoredPart;
types.Message = Message;
types.isColoredPart = isColoredPart;
types.isMessage = isMessage;
types.GradientPart = GradientPart;
types.isGradientPart = isGradientPart;
types.MultiPart = MultiPart;
types.isMultiPart = isMultiPart;
})();
