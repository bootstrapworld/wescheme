// if not defined, declare the compiler object as part of plt
window.plt   = window.plt || {};
plt.compiler = plt.compiler || {};

/*
 
 Follows WeScheme's current implementation of Advanced Student
 http://docs.racket-lang.org/htdp-langs/advanced.html
 NOT SUPPORTED BY WESCHEME: define-datatype, begin0, set!, time, delay, shared, recur,
    match, check-member-of, check-range, (require planet), byetstrings (#"Apple"),
    regexps (#rx or #px), hashtables (#hash), graphs (#1=100 #1# #1#), #reader and #lang
 
 
 TODO
 - JSLint
 - have every read function set i, then remove i-setting logic?
 - collect all regexps into RegExp objects
 - treat syntax and unsyntax as errors
 */

//////////////////////////////////////////////////////////////////////////////
////////////////////////////////// LEXER OBJECT //////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// Parse a program into SExps
//
// A SExp is either:
// - Literal x Location
// - symbolExpr x Location
// - [ListOf SExp] x Location
//
// A Literal is either:
// - types.<number>
// - types.string
// - types.char
// - types.vector

    /////////////////////
    /*      Data       */
    /////////////////////

(function () {
    'use strict';

    // a collection of common RegExps
    var leftListDelims  = /[(\u005B\u007B]/,
        rightListDelims = /[)\u005D\u007D]/,
        matchUntilDelim = /^[^(\u005B\u007B)\u005D\u007D\s]+/,
        quotes          = /[\'`,]/,
        hex2            = new RegExp("^([0-9a-f]{1,2})", "i"),
        hex4            = new RegExp("^([0-9a-f]{1,4})", "i"),
        hex8            = new RegExp("^([0-9a-f]{1,8})", "i"),
        oct3            = new RegExp("^([0-7]{1,3})", "i");

    // the delimiters encountered so far, line and column, and case-sensitivity
    var delims, line, column, sCol, sLine, source, caseSensitiveSymbols = true;
    // UGLY HACK to track index if an error occurs. We should remove this if we can make i entirely stateful
    var endOfError;
                            
    // the location struct
    var Location = function(sCol, sLine, offset, span, theSource){
      this.sCol   = sCol;   // starting index into the line
      this.sLine  = sLine;  // starting line # (1-index)
      this.offset = offset; // ch index of lexeme start, from beginning
      this.span   = span;   // num chrs between lexeme start and end
      this.source = theSource || source; // [OPTIONAL] id of the containing DOM element
      this.start  = function(){ return new Location("", "", this.offset, 1); };
      this.end    = function(){ return new Location("", "", this.offset+this.span-1, 1); };
      this.toString = function(){
        return "Loc("+this.sCol+", "+this.sLine+", "+(this.offset+1)+","+this.span+")";
      };
      this.toVector = function(){
        return new types.vector(['"'+this.source+'"' // add quotes to the source, since it's a str (not a symbol)
                                ,this.offset+1
                                ,this.sLine
                                ,this.sCol
                                ,this.span]);
      };
      this.toBytecode = function(){
        return {line: this.sLine.toString(), id: this.source, span: this.span.toString(),
               offset: (this.offset+1).toString(), column: this.sCol.toString()};
      };
    };

    /////////////////////
    /* Utility Methods */
    /////////////////////
                   
    // some important string methods
    function isWhiteSpace(str) {
      return (/\s/).test(str);
    }

    // determines if a character string is in one of the three sets of delimiters
    function isDelim(x) {
      return x === '(' || x === ')'
        ||   x === '[' || x === ']'
        ||   x === '{' || x === '}';
    }

    // this is returned when a comment is read
    function Comment(txt) {this.txt = txt;}

    // determines if the character is valid as a part of a symbol
    function isValidSymbolCharP(x) {
      return !isDelim(x) && !isWhiteSpace(x)
            && x !== '"' && x !== ',' && x !== "'"
                        && x !== '`' && x !== ';';
    }

    // determines if they are matching delimiter pairs
    // ie ( and ) [ and ] { and }
    function matchingDelims(x, y) {
      return (x === '(' && y === ')')
        ||   (x === '[' && y === ']')
        ||   (x === '{' && y === '}');
    }

    // gets the matching delim given the other delim in a pair
    function otherDelim(x) {
      return  x === '(' ? ')' :
              x === '[' ? ']' :
              x === '{' ? '}' :
              x === ')' ? '(' :
              x === ']' ? '[' :
              x === '}' ? '{' :
    /* else */ throwError(new types.Message(["otherDelim: Unknown delimiter: ", x]));
    }

    // reads through whitespace
    function chewWhiteSpace(str, i) {
      var p;
      if(i < str.length) {
        p = str.charAt(i);
        while (isWhiteSpace(p) && i < str.length) {
          // increment column/line counters
          if(p==="\n"){ line++; column = 0;}
          else { column++; }
          p = str.charAt(++i);
        }
      }
      return i;
    }

    Array.prototype.toString = function () {return this.join(" "); };
    function sexpToString(sexp) {
      return (sexp instanceof Array)? "(" + sexp.map(sexpToString).toString() + ")"
                                    : sexp.toString();
    }

                   
    /////////////////////
    /* Primary Methods */
    /////////////////////

    // readProg : String String -> SExp
    // reads multiple sexps encoded into this string and converts them to a SExp
    // datum
    function readProg(str, strSource) {
      var i = 0; sCol = column = 0; sLine = line = 1; // initialize all position indices
      source = strSource || "<definitions>";
      var sexp,
          sexps = [];
      delims = [];
      // get rid of any whitespace at the start of the string
      i = chewWhiteSpace(str, 0);
      while(i < str.length) {
        sexp = readSExpByIndex(str, i);
        if(!(sexp instanceof Comment)) { sexps.push(sexp); }
        i = chewWhiteSpace(str, sexp.location.offset+sexp.location.span);
      }
      return sexps;
    }

    // readSSFile : String String -> SExp
    // removes the first three lines of the string that contain DrScheme meta data
    function readSSFile(str, strSource) {
      var i = 0; sCol = column = 0; sline = line = 1; // initialize all position indices
      source = strSource || "<definitions>";
      var crs = 0;

      while(i < str.length && crs < 3) {
        if(str.charAt(i++) === "\n") { crs++; }
      }

      var sexp, sexps = [];
      delims = [];
      while(i < str.length) {
        sexp = readSExpByIndex(str, i);
        if(!(sexp instanceof Comment)) { sexps.push(sexp); }
        i = chewWhiteSpace(str, sexp.location.offset+sexp.location.span);
      }
      return sexps;
    }

    // readSExp : String String -> SExp
    // reads the first sexp encoded in this string and converts it to a SExp datum
    function readSExp(str, source) {
      delims = [];
      var sexp = readSExpByIndex(str, 0);
      return sexp instanceof Comment ? null : sexp;
    }

    // readSExpByIndex : String Number -> SExp
    // reads a sexp encoded as a string starting at the i'th character and converts
    // it to a SExp datum
    function readSExpByIndex(str, i) {
      sCol = column; sLine = line; var iStart = i;
      i = chewWhiteSpace(str, i);
      var p = str.charAt(i);
      if(i >= str.length) {
        endOfError = i; // HACK - remember where we are, so readList can pick up reading
        throwError(new types.Message([source , ":"
                                      , sLine.toString(), ":"
                                      , (sCol-1).toString()
                                      , ": read: (found end-of-file)"])
                   ,new Location(sCol-1, sLine, i-2, 2) // back up the offset before #;, make the span include only those 2
                   ,"Error-GenericReadError");
      }
      var sexp = rightListDelims.test(p) ?
                   throwError(new types.Message(["read: expected a ", otherDelim(p), " to open "
                                                , new types.ColoredPart(p, new Location(column, sLine, iStart, 1))])
                              ,new Location(column, sLine, iStart, 1)) :
                 leftListDelims.test(p) ? readList(str, i) :
                 p === '"'                  ? readString(str, i) :
                 p === '#'                  ? readPoundSExp(str, i) :
                 p === ';'                  ? readLineComment(str, i) :
                 quotes.test(p)             ? readQuote(str, i) :
                  /* else */                   readSymbolOrNumber(str, i);
       return sexp;
    }

    // readList : String Number -> SExp
    // reads a list encoded in this string with the left delimiter at index i
    function readList(str, i) {
      var sCol=column, sLine=line, iStart=i, innerError=false,
          errorLocation = new Location(sCol, sLine, iStart, 1),
          openingDelim = str.charAt(i++);
      column++; // move forward to count the closing delimeter
      var sexp, list = [];
      delims.push(openingDelim);
      i = chewWhiteSpace(str, i);
                            
      // read forward until we see a closing delim, saving the last known-good location
      while (i < str.length && !rightListDelims.test(str.charAt(i))) {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        try{
          sexp = readSExpByIndex(str, i);           // try to read the next s-exp
          i = sexp.location.end().offset+1;         // move i to the character at the end of the sexp
          // if it's a dot, treat it as a cons
          if(sexp instanceof symbolExpr && sexp.val == '.'){
            sexp = readSExpByIndex(str, i);        // read the next sexp
            if(!(sexp instanceof Array)){           // if it's not a list, throw an error
               throwError(new types.Message(["A `.' must be followed by a syntax list, but found "
                                            , new types.ColoredPart("something else", sexp.location)])
                          , sexp.location);
            }
            list = list.concat(sexp);              // if it IS, splice it into this one
            i = sexp.location.end().offset+1;
          } else if(!(sexp instanceof Comment)){     // if it's not a comment, add it to the list
            sexp.parent = list;                     // set this list as it's parent
            list.push(sexp);                        // and add the sexp to the list
          }
        } catch (e){                            // try to keep reading from endOfError...
          // If the error is brace or dot error, throw it. Otherwise swallow it and keep reading
          if(/expected a .+ to (close|open)/.exec(e) || /unexpected/.exec(e) || /syntax list/.exec(e)){
            throw e;
          } else {
            var eLoc = JSON.parse(JSON.parse(e)["structured-error"]).location;
            errorLocation = new Location(Number(eLoc.column), Number(eLoc.line),
                                         Number(eLoc.offset)-1, Number(eLoc.span));
            i = endOfError;// keep reading from the last error location
            innerError = e;
          }
        }
        // move reader to the next token
        i = chewWhiteSpace(str, i);
      }
      // if we reached the end of an otherwise-successful list but there's no closing delim...
      if(i >= str.length) {
         var msg = new types.Message(["read: expected a ", otherDelim(openingDelim),
                                      " to close ",
                                      new types.ColoredPart(openingDelim.toString(),
                                                            new Location(sCol, sLine, iStart, 1))
                                      ]);
         // throw an error
         throwError(msg, errorLocation);
      }
      // if we reached the end of an otherwise-successful list and it's the wrong closing delim...
      if(!matchingDelims(openingDelim, str.charAt(i))) {
         var msg = new types.Message(["read: expected a ", otherDelim(openingDelim),
                                      " to close ",
                                      new types.ColoredPart(openingDelim.toString(),
                                                            new Location(sCol, sLine, iStart, 1)),
                                      " but found a ",
                                      new types.ColoredPart(str.charAt(i).toString(),
                                                            new Location(column, line, i, 1))
                                      ]);
         throwError(msg, new Location(column, line, i, 1));
      }
      
      column++; i++;  // move forward to count the closing delimeter
      // if an error occured within the list, set endOfError to the end, and throw it
      if(innerError){ endOfError = i; throw innerError; }
      list.location = new Location(sCol, sLine, iStart, i-iStart);
      return list;
    }

    // readString : String Number -> SExp
    // reads a string encoded in this string with the leftmost quotation mark
    // at index i
    function readString(str, i) {
      var sCol = column, sLine = line, iStart = i;
      // greedily match to the end of the string, before examining escape sequences
      var closedString = /^\"[^\"]*(\\\"[^\"]*)*[^\\]\"|\"\"/.test(str.slice(i)),
          greedy = /^\"[^\"]*(\\"[^\"]*)*/.exec(str.slice(iStart))[0];
      i++; column++; // skip over the opening quotation mark char
      // it's a valid string, so let's make sure it's got proper escape sequences
      var chr, datum = "";
      while(i < str.length && str.charAt(i) !== '"') {
        chr = str.charAt(i++);
        // track line/char values while we scan
        if(chr === "\n"){ line++; column = 0;}
        else { column++; }
        if(chr === '\\') {
          column++; // move the column forward to skip over the escape character
          chr = str.charAt(i++);
          if(i >= str.length) break; // if there's nothing there, break out
          switch(true){
             case /a/.test(chr)  : chr = '\u0007'; break;
             case /b/.test(chr)  : chr = '\b'; break;
             case /t/.test(chr)  : chr = '\t'; break;
             case /n/.test(chr)  : chr = '\n'; break;
             case /v/.test(chr)  : chr = '\v'; break;
             case /f/.test(chr)  : chr = '\f'; break;
             case /r/.test(chr)  : chr = '\r'; break;
             case /e/.test(chr)  : chr = '\u0027'; break;
             case /\"/.test(chr)  : break;
             case /\'/.test(chr)  : break;
             case /\\/.test(chr) : break;
             // if it's a charCode symbol, match with a regexp and move i forward
             case /x/.test(chr)  :
                var match = hex2.exec(str.slice(i))[1];
                chr = String.fromCharCode(parseInt(match, 16));
                i += match.length; column += match.length;
                break;
             case /u/.test(chr)  :
                var match = hex4.exec(str.slice(i))[1];
                chr = String.fromCharCode(parseInt(match, 16));
                i += match.length; column += match.length;
                break;
             case /U/.test(chr)  :
                var match = hex8.exec(str.slice(i))[1];
                chr = String.fromCharCode(parseInt(match, 16));
                i += match.length; column += match.length;
                break;
             case oct3.test(str.slice(i-1)) :
                var match = oct3.exec(str.slice(i-1))[1];
                chr = String.fromCharCode(parseInt(match, 8));
                i += match.length-1; column += match.length-1;
                break;
             default   :
                // HACK - remember where we are, so readList can pick up reading
                endOfError = iStart+greedy.length+1;
                throwError(new types.Message([source, ":"
                                              , sLine.toString(), ":"
                                              , sCol.toString()
                                              , ": read: unknown escape sequence \\" +chr+" in string"])
                           , new Location(sCol, sLine, iStart, i-iStart)
                           , "Error-GenericReadError");
                  }
        }
        datum += chr;
      }

      // if the next char after iStart+openquote+greedy isn't a closing quote, it's an unclosed string
      if(!closedString) {
        endOfError = iStart+greedy.length; // HACK - remember where we are, so readList can pick up reading
        throwError(new types.Message([source, ":"
                                      , sLine.toString(), ":"
                                      , sCol.toString()
                                      , ": read: expected a closing \'\"\'"])
                   , new Location(sCol, sLine, iStart, 1)
                   , "Error-GenericReadError");
      }
      var strng = new literal(new types.string(datum));
      i++; column++; // move forward to include the ending quote
      strng.location = new Location(sCol, sLine, iStart, i-iStart);
      return strng;
    }

    // readPoundSExp : String Number -> SExp
    // based on http://docs.racket-lang.org/reference/reader.html#%28part._default-readtable-dispatch%29
    // NOTE: bytestrings, regexps, hashtables, graphs, reader and lang extensions are not supported
    function readPoundSExp(str, i) {
      var sCol = column, sLine = line, iStart = i, datum;
      i++; column++; // skip over the pound sign
      // construct an unsupported error string
      var unsupportedError;
                            
      // throwUnsupportedError : ErrorString token -> Error
      function throwUnsupportedError(errorStr, token){
        throwError(new types.Message([source, ":", line.toString()
                                           , ":", (column-1).toString()
                                           , errorStr])
                        , new Location(sCol, sLine, iStart, token.length+1)
                        , "Error-GenericReadError");
      }
               
      if(i < str.length) {
        var p = str.charAt(i).toLowerCase();
        // fl and fx Vectors, structs, and hashtables are not supported
        var unsupportedMatch = new RegExp("^(((fl|fx|s|hash|hasheq)[\[\(\{])|((rx|px)\#{0,1}\"))", "g"),
            unsupportedTest = unsupportedMatch.exec(str.slice(i));
        // Reader or Language Extensions are not allowed
        var badExtensionMatch = /^(!(?!\/)|reader|lang[\s]{0,1})/,
            badExtensionTest = badExtensionMatch.exec(str.slice(i));
        // Case sensitivity flags ARE allowed
        var caseSensitiveMatch = new RegExp("^(c|C)(i|I|s|S)", "g"),
            caseSensitiveTest = caseSensitiveMatch.exec(str.slice(i));
        // Vector literals ARE allowed
        var vectorMatch = new RegExp("^([0-9]*)[\[\(\{]", "g"),
            vectorTest = vectorMatch.exec(str.slice(i));
        if(unsupportedTest && unsupportedTest[0].length > 0){
            var sexp = readSExpByIndex(str, i+unsupportedTest[0].length-1),
                kind, span = unsupportedTest[0].length, // save different error strings and spans
                base = unsupportedTest[0].replace(/[\(\[\{\"|#\"]/g, '');
            switch(base){
              case "fl":    kind = "flvectors"; break;
              case "fx":    kind = "fxvectors"; break;
              case "s":     kind = "structs";   break;
              case "hash":
              case "hasheq":kind = "hashtables"; break;
              case "px":
              case "rx":    kind = "regular expressions"; break;
              default: throw "IMPOSSIBLE: unsupportedMatch captured something it shouldn't: "+base;
            }
            var error = new types.Message([source, ":", line.toString(), ":", "0"
                                           , ": read-syntax: literal "+ kind + " not allowed"]);
            datum = new unsupportedExpr(sexp, error, span);
            datum.location = new Location(sCol, sLine, iStart, unsupportedTest[0].length+sexp.location.span);
            return datum;
        } else if(badExtensionTest && badExtensionTest[0].length > 0){
            throwUnsupportedError(": read: #" + badExtensionTest[0].trim()
                              + " not enabled in the current context"
                                  , badExtensionTest[0]);
        } else if(caseSensitiveTest && caseSensitiveTest[0].length > 0){
            caseSensitiveSymbols = (caseSensitiveTest[0].toLowerCase() === "cs");
            i+=2; column+=2;
            return readSExpByIndex(str, i);
        } else if(vectorTest && vectorTest[0].length > 0){
          var size = (vectorTest[1])? parseInt(vectorTest[1]) : "",    // do we have a size string?
              sizeChars = size.toString().length;                     // how long is the size string?
          i+=sizeChars; column+=sizeChars           // start reading after the vectorsize was specified
          var elts = readList(str, i),
              len = size===""? elts.length : parseInt(vectorTest[1]);  // set the size to a number
          // test vector size
          if(elts.length > len){
             var msg = new types.Message(["read: vector length "+len+" is too small, ",
                                          elts.length+" value" + ((elts.length>1)? "s" : ""),
                                          " provided"]);
             throwError(msg, new Location(sCol, sLine, iStart, elts.length+1));
          }

          i+=elts.location.span;
          datum = new literal(new Vector(len, elts));
          datum.location = new Location(sCol, sLine, iStart, i-iStart);
          return datum;
        } else {
          // match every valid (or *almost-valid*) sequence of characters, or the empty string
          var chunk = /^(hasheq|hash|fl|fx|\d+|[tfeibdox]|\<\<|[\\\"\%\:\&\|\;\!\`\,\']|)/i.exec(str.slice(i))[0],
          // match the next character
              nextChar = str.charAt(i+chunk.length);
          // grab the first non-whitespace character
          var p = chunk.charAt(0).toLowerCase();
          switch(p){
            // CHARACTERS
            case '\\': datum = readChar(str, i-1);
                       i+= datum.location.span-1; break;
            // BYTE-STRINGS (unsupported)
            case '"': throwUnsupportedError(": byte strings are not supported in WeScheme", "#\"");
            // SYMBOLS
            case '%': datum = readSymbolOrNumber(str, i);
                      datum.val = '#'+datum.val;
                      i+= datum.location.span; break;
            // KEYWORDS (lex to a symbol, then strip out the contents)
            case ':': datum = readSymbolOrNumber(str, i-1);
                      var error = new types.Message([source, ":", line.toString(), ":", "0"
                                                   , ": read-syntax: Keyword internment is not supported in WeScheme"]);
                      datum = new unsupportedExpr(datum.val, error, datum.location.span);
                      i+= datum.val.length-1;
                      break;
            // BOXES
            case '&': column++;
                      sexp = readSExpByIndex(str, i+1);
                      var boxCall = new symbolExpr("box"),
                          datum = [boxCall, sexp];
                      i+= sexp.location.span+1;
                      boxCall.location = new Location(sCol, sLine, iStart, i-iStart);
                      break;
            // BLOCK COMMENTS
            case '|': i--;
                      datum = readBlockComment(str, i);
                      i+= datum.location.span+1; break;
            // SEXP COMMENTS
            case ';':  datum = readSExpComment(str, i+1);
                       column=i+= datum.location.span+1; break;
            // LINE COMMENTS
            case '!': datum = readLineComment(str, i-1);
                       i+= datum.location.span; break;
            // SYNTAX QUOTES, UNQUOTES, AND QUASIQUOTES
            case '`':
            case ',':
            case '\'': datum = readQuote(str, i);
                      datum.location.offset--; datum.location.span++; // expand the datum to include leading '#'
                      endOfError = i+datum.location.span;
                      throwError(new types.Message([source, ":", sLine.toString()
                                                    , ":", (column-1).toString()
                                                    , " read: WeScheme does not support the '#"+p+"' notation for "
                                                    , (p===","? "unsyntax" : p==="'"? "syntax" : "quasisyntax")])
                                  , datum.location);
                      break;
            // STRINGS
            case '<<': datum = readString(str, i-1);
                       i+= datum.location.span; break;
            // NUMBERS
            case 'e':  // exact
            case 'i':  // inexact
            case 'b':  // binary
            case 'o':  // octal
            case 'd':  // decimal
            case 'x':  // hexadecimal
                column--; //  back up the column one char
                datum = readSymbolOrNumber(str, i-1);
                i+= datum.location.span-1; break;
            // BOOLEANS
            case 't':  // true
            case 'f':  // false
                if(!matchUntilDelim.exec(nextChar)){ // if there's no other chars aside from space or delims...
                  datum = new literal(p=='t');       // create a Boolean literal
                  i++; column++;                     // move i/col ahead by the char
                  break;
                }
            default:
              endOfError = i; // HACK - remember where we are, so readList can pick up reading
              throwError(new types.Message([source, ":", line.toString()
                                           , ":", (column-1).toString()
                                           , ": read: bad syntax `#", (chunk+nextChar),"'"])
                        , new Location(sCol, sLine, iStart, (chunk+nextChar).length+1)
                        , "Error-GenericReadError");
           }
        }
      // only reached if # is the end of the string...
      } else {
        endOfError = i; // HACK - remember where we are, so readList can pick up reading
        throwError(new types.Message([source, ":", line.toString()
                                     , ":" , (column-1).toString()
                                     , ": read: bad syntax `#'"])
                  , new Location(sCol, sLine, iStart, i-iStart)
                  , "Error-GenericReadError");
      }
      datum.location = new Location(sCol, sLine, iStart, i-iStart);
      return datum;
    }

    // readChar : String Number -> types.char
    // reads a character encoded in the string and returns a representative datum
    function readChar(str, i) {
      var sCol = column, sLine = line, iStart = i;
      i+=2;  column++; // skip over the #\\
      var datum = "";
      // read until we hit the end of the string, a delimiter, whitespace, or another char
      while(i < str.length && !isDelim(str.charAt(i))
            && !isWhiteSpace(str.charAt(i)) && (str.slice(i,i+2) !== "#\\")) {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        else { column++; }
        datum += str.charAt(i++);
      }
      datum = datum === 'nul' || datum === 'null' ? '\u0000' :
                          datum === 'backspace' ? '\b' :
                          datum === 'tab'       ? '\t' :
                          datum === 'newline'   ? '\n' :
                          datum === 'vtab'      ? '\u000B' :
                          datum === 'page'      ? '\u000C' :
                          datum === 'return'    ? '\r' :
                          datum === 'space'     ? '\u0020' :
                          datum === 'rubout'    ? '\u007F' :
                          datum === ' '         ? '\u0020' :
                          datum.length === 1   ? datum :
                            throwError(new types.Message(["read: Unsupported character: #\\",datum]),
                                       new Location(sCol, sLine, iStart, i-iStart));
      var chr = new literal(new types['char'](datum));
      chr.location = new Location(sCol, sLine, iStart, i-iStart);
      return chr;
    }

    // readBlockComment : String Number -> Atom
    // reads a multiline comment
    function readBlockComment(str, i) {
      var sCol = column, sLine = line, iStart = i;
      i+=2; column+=2; // skip over the #|
      var txt = "";
      while(i+1 < str.length && !(str.charAt(i) === '|' && str.charAt(i+1) === '#')) {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        txt+=str.charAt(i);
        i++; column++;  // move ahead
      }
      if(i+1 >= str.length) {
        throwError(new types.Message(["read: Unexpected EOF when reading a multiline comment"])
                   ,new Location(sCol, sLine, iStart, i-iStart));
      }
      i++; column++; // hop over '|#'
      var comment = new Comment(txt);
      comment.location = new Location(sCol, sLine, iStart, i-iStart);
      return comment;
    }

    // readSExpComment : String Number -> Atom
    // reads exactly one SExp and ignores it entirely
    function readSExpComment(str, i) {
      var sCol = column, sLine = line;
      if(i+1 >= str.length) {
        endOfError = i; // HACK - remember where we are, so readList can pick up reading
        throwError(new types.Message([source , ":" , sLine.toString(), ":", (sCol-1).toString()
                                      , ": read: expected a commented-out element for `#;' (found end-of-file)"])
                   ,new Location(sCol-1, sLine, i-2, 2) // back up the offset before #;, make the span include only those 2
                   ,"Error-GenericReadError");
      }
      var ignore = readSExpByIndex(str, i); // we only read this to extract location
      i =+ ignore.location.span;
      var atom = new Comment();
      atom.location = ignore.location;  // use the location for our new, empty sexp
      return atom;
    }

    // readLineComment : String Number -> Atom
    // reads a single line comment
    function readLineComment(str, i) {
      var sCol = column, sLine = line, iStart = i;
      i++; column++; // skip over the ;
      var txt = "";
      while(i < str.length && str.charAt(i) !== '\n') {
        // track column values while we scan
        txt+=str.charAt(i); column++; i++;
      }
      if(i > str.length) {
        endOfError = i; // HACK - remember where we are, so readList can pick up reading
        throwError(new types.Message(["read: Unexpected EOF when reading a line comment"]),
                   new Location(sCol, sLine, iStart, i-iStart));
      }
      var atom = new Comment(txt);
      atom.location = new Location(sCol, sLine, iStart, i+1-iStart);
      // at the end of the line, reset line/col values
      line++; column = 0;
      return atom;
    }

    // readQuote : String Number -> SExp
    // reads a quote, quasiquote, or unquote encoded as a string
    function readQuote(str, i) {
      var sCol = column, sLine = line, iStart = i, nextSExp;
      var p = str.charAt(i);
      var symbol = p == "'" ? new symbolExpr("quote") :
                   p == "`" ? new symbolExpr("quasiquote") :
                   /* else */  "";
      function eofError(i){
        endOfError = i+1; // HACK - remember where we are, so readList can pick up reading
        var action = p == "'" ? " quoting " :
                     p == "`" ? " quasiquoting " :
                     p == "," ? " unquoting " :
                     /* else */  "";
        throwError(new types.Message([source, ":", sLine.toString(), ":", column.toString()
                                      , ": read: expected an element for" + action, p
                                      , " (found end-of-file)"])
                   , new Location(column, sLine, iStart, 1)
                   , "Error-GenericReadError");
      }
      if(i+1 >= str.length) { eofError(i); }
      i++; column++; // read forward one char
      if(p == ',') {
        if(str.charAt(i) == '@') {
          i++; column++; // read forward one char
          symbol = new symbolExpr("unquote-splicing");
        } else {
          symbol = new symbolExpr("unquote");
        }
      }

      symbol.location = new Location(column, sLine, iStart, i - iStart + 1);

      // read the next non-comment sexp
      while(!nextSExp || (nextSExp instanceof Comment)){
        i = chewWhiteSpace(str, i);
        try{nextSExp = readSExpByIndex(str, i);}
        catch(e){
          // if it's the end of file, throw a special EOF for quoting
          if(/read\: \(found end-of-file\)/.test(e)) eofError(i);
          var unexpected = /expected a .* to open \",\"(.)\"/.exec(e);
          if(unexpected){
            endOfError = i+1; // HACK - remember where we are, so readList can pick up reading
            throwError(new types.Message([source, ":", line.toString(), ":", column.toString()
                                          , ": read: unexpected `" + unexpected[1] + "'"])
                       , new Location(column, line, i, 1)
                       , "Error-GenericReadError");
          }
          throw e;
        }
        i = nextSExp.location.end().offset+1;
      }
      var quotedSexp = [symbol, nextSExp],
          quotedSpan = (nextSExp.location.end().offset+1) - iStart;
      
      quotedSexp.location = new Location(sCol, sLine, iStart, quotedSpan);
      return quotedSexp;
    }
                   
                                                                
    // readSymbolOrNumber : String Number -> symbolExpr | types.Number
    function readSymbolOrNumber(str, i){
      var sCol = column, sLine = line, iStart = i;
      // match anything consisting of stuff between two |bars|, **OR**
      // non-whitespace characters that do not include:  ( ) { } [ ] , ' ` | \\ " ;
      var chunk = /(\|.*\||\\.|[^\(\)\{\}\[\]\,\'\`\s\"\;])+/mg.exec(str.slice(i))[0];
      // if the chunk *and the string* end with an escape, throw an error
      if((chunk.charAt(chunk.length-1)==="\\") && (i+chunk.length+1 > str.length)){
            i = str.length; // jump to the end of the string
            endOfError = i; // remember where we are, so readList can pick up reading
            throwError(new types.Message([source, ":", line.toString(), ":", sCol.toString(),
                                          ": read: EOF following `\\' in symbol"])
                       ,new Location(sCol, sLine, iStart, i-iStart)
                       ,"Error-GenericReadError");
      }
                                
      // move the read head and column tracker forward
      i+=chunk.length; column+=chunk.length;
      
      // split the chunk at each |
      var chunks = chunk.split("|");
                                
      // check for balanced |'s
      if(((chunks.length%2) === 0)){
          endOfError = i;
          throwError(new types.Message([source, ":", line.toString(), ":", sCol.toString(),
                                        ": read: unbalanced `|'"])
                       ,new Location(sCol, sLine, iStart, i-iStart)
                       ,"Error-GenericReadError");
      }
                                
      // enforce case-sensitivity for non-verbatim sections. Remove all escape characters
      var filtered = chunks.reduce(function(acc, str, i){
            // if we're inside a verbatim portion (i is even) *or* we're case sensitive, preserve case
            return acc+= (i%2 || caseSensitiveSymbols)? str : str.toLowerCase();
          }, "").replace(/\\/g,'');

      // special-case: if it's the empty string, than it should be read as a newline character
      if(filtered===""){filtered = "\n"; i++; line++; column=0;}
                                
      // add bars if it's a symbol that needs those escape characters
      filtered = /[\(\)\{\}\[\]\,\'\`\s\"]/g.test(filtered)? "|"+filtered+"|" : filtered;
                   
      // attempt to parse using jsnums.fromString(), assign to sexp and add location
      // if it's a bad number, throw an error
      try{
        var numValue = jsnums.fromString(filtered, true),
            node     = (numValue || numValue === 0)?  // don't interpret zero as 'false'
                            new literal(numValue) : new symbolExpr(filtered);
        node.location = new Location(sCol, sLine, iStart, i-iStart);
        return node;
      // if it's not a number OR a symbol
      } catch(e) {
          endOfError = i; // HACK - remember where we are, so readList can pick up reading
          throwError(new types.Message([source, ":", sLine.toString()
                                        , ":" , sCol.toString()
                                        , ": read: "+e.message])
                     , new Location(sCol, sLine, iStart, i-iStart)
                     , "Error-GenericReadError");
      }
                            
    }
    /////////////////////
    /* Export Bindings */
    /////////////////////
    plt.compiler.lex = readProg;
    plt.compiler.sexpToString = sexpToString;
})();
