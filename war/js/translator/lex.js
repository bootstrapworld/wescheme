/* 
 
 Follows WeScheme's current implementation: http://docs.racket-lang.org/htdp-langs/advanced.html
 NOT SUPPORTED BY WESCHEME:
  - define-datatype
  - begin0
  - set!
  - time
  - delay
  - shared
  - recur
  - match
  - check-member-of
  - check-range
  - (require planet)
  - byetstrings (#"Apple")
  - regexps
  - #hash
  - #rx or #px
  - graphs (#1=100 #1# #1#)
 
 
 TODO
 - JSLint
 */

//////////////////////////////////////////////////////////////////////////////
////////////////////////////////// LEXER OBJECT //////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// Parse a program into SExps
//
// A SExp is either:
// - Atom x Location
// - [ListOf SExp] x Location
//
// An Atom is either:
// - numberExpr
// - symbolExpr
// - stringExpr
// - booleanExpr
// - charExpr
// - vectorExpr

    /////////////////////
    /*      Data       */
    /////////////////////

(function () {
    'use strict';

    // a collection of common RegExps
    var leftListDelims  = /[(\u005B\u007B]/,
        rightListDelims = /[)\u005D\u007D]/,
        quotes          = /[\'`,]/,
        hex2            = new RegExp("([0-9a-f]{1,2})", "i"),
        hex4            = new RegExp("([0-9a-f]{1,4})", "i"),
        hex8            = new RegExp("([0-9a-f]{1,8})", "i"),
        oct3            = new RegExp("([0-7]{1,3})", "i");

    // the delimiters encountered so far, and line and column
    var delims, line, column, sCol, sLine, source;

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
        return new vectorExpr([new numberExpr(this.sCol), new numberExpr(this.sLine)
                              ,new numberExpr(this.offset+1), new numberExpr(this.span)
                              ,this.source]
                             ,new numberExpr(5));
      };
      this.toJSON = function(){
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
      var str="";
      if(sexp instanceof Array) {
        str += "(" + sexp.map(sexpToString).toString() + ")";
      } else {
        str += sexp.toString();
      }

      return str;
    }

                   
    /////////////////////
    /* Primary Methods */
    /////////////////////

    // readProg : String String -> SExp
    // reads multiple sexps encoded into this string and converts them to a SExp
    // datum
    function readProg(str, strSource) {
      var i = 0; sCol = column = 0; sLine = line = 1; // initialize all position indices
      source = strSource || "<unknown>";
      var sexp,
          sexps = [];
      delims = [];
      // get rid of any whitespace at the start of the string
      i = chewWhiteSpace(str, 0);
      while(i < str.length) {
        sexp = readSExpByIndex(str, i);
        if(!(sexp instanceof Comment)) {
          sexps.push(sexp);
        }
        i = chewWhiteSpace(str, sexp.location.offset+sexp.location.span);
      }
      return sexps;
    }

    // readSSFile : String String -> SExp
    // removes the first three lines of the string that contain DrScheme meta data
    function readSSFile(str, strSource) {
      var i = 0; sCol = column = 0; sline = line = 1; // initialize all position indices
      source = strSource || "unknown";
      var crs = 0;

      while(i < str.length && crs < 3) {
        if(str.charAt(i++) === "\n") { crs++; }
      }

      var sexp, sexps = [];
      delims = [];
      while(i < str.length) {
        sexp = readSExpByIndex(str, i);
        if(!(sexp instanceof Comment)) {
          sexps.push(sexp);
        }
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
      var p;
      p = str.charAt(i);
                            console.log('first char is '+p);
      i = chewWhiteSpace(str, i);
                            console.log('after chewing, i is '+i);
      if(i >= str.length) {
        throwError(new types.Message(["Unexpected EOF while reading a SExp"])
                                 ,new Location(sCol, sLine, iStart, i-iStart));
      }
      var sexp = rightListDelims.test(p) ?
                   throwError(new types.Message(["read: expected a ", otherDelim(p), " to open "
                                                , new types.ColoredPart(p, new Location(sCol, sLine, iStart, 1))])
                              ,new Location(sCol, sLine, iStart, 1)) :
                 leftListDelims.test(p) ? readList(str, i) :
                 p === '"'                  ? readString(str, i) :
                 p === '#'                  ? readPoundSExp(str, i) :
                 p === ';'                  ? readLineComment(str, i) :
                 quotes.test(p)             ? readQuote(str, i) :
                  /* else */                   readSymbolOrNumber(str, i);
                            console.log(sexp);
       return sexp;
    }

    // readList : String Number -> SExp
    // reads a list encoded in this string with the left delimiter at index i
    function readList(str, i) {
      var sCol = column, sLine = line, iStart = i;
      var openingDelim = str.charAt(i++);
      column++; // count the openingDelim
      var sexp, list = [];
      delims.push(openingDelim);
                   
      i = chewWhiteSpace(str, i);

      while (i < str.length && !rightListDelims.test(str.charAt(i))) {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        sexp = readSExpByIndex(str, i);

        if(!(sexp instanceof Comment)) {
          list.push(sexp);
        }

        i = chewWhiteSpace(str, sexp.location.offset+sexp.location.span);
      }

      if(i >= str.length) {
         var msg = new types.Message(["read: expected a ",
                                      otherDelim(openingDelim),
                                      " to close ",
                                      new types.ColoredPart(openingDelim.toString(),
                                                            new Location(sCol, sLine, iStart, 1))
                                      ]);
         throwError(msg, new Location(sCol, sLine, iStart, 1));
      }
      if(!matchingDelims(openingDelim, str.charAt(i))) {
         var msg = new types.Message(["read: expected a ",
                                      otherDelim(openingDelim),
                                      " to close ",
                                      new types.ColoredPart(openingDelim.toString(),
                                                            new Location(sCol, sLine, iStart, 1)),
                                      " but found a ",
                                      new types.ColoredPart(str.charAt(i).toString(),
                                                            new Location(column, line, i, 1))
                                      ]);
         throwError(msg, new Location(column, line, i, 1));
      }
      // add 1 to span to count the closing delimeter
      column++;
      list.location = new Location(sCol, sLine, iStart, i-iStart+1);
      return list;
    }

    // readString : String Number -> SExp
    // reads a string encoded in this string with the leftmost quotation mark
    // at index i
    function readString(str, i) {
      var sCol = column, sLine = line, iStart = i;
      i++; // skip over the opening quotation mark and char
      column++;
                   
      var chr, datum = "";

      while(i < str.length && str.charAt(i) !== '"') {
        chr = str.charAt(i++);
        // track line/char values while we scan
        if(chr === "\n"){ line++; column = 0;}
        else { column++; }

        if(chr === '\\') {
          chr = str.charAt(i++);
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
        throwError(new types.Message([source
                                      , ":"
                                      , sLine.toString()
                                      , ":"
                                      , sCol.toString()
                                      , ": read: unknown escape sequence \\" +chr+" in string"])
                   , new Location(sCol, sLine, iStart, i-iStart));
          }
        }
        datum += chr;
      }

      if(i >= str.length) {
        sCol++; // move forward to grab the starting quote
        throwError(new types.Message([source
                                      , ":"
                                      , sLine.toString()
                                      , ":"
                                      , (sCol-1).toString()
                                      , ": read: expected a closing \'\"\'"])
                   , new Location((sCol-1), sLine, iStart, 1)
                   , "Error-GenericReadError");
      }
      var strng = new stringExpr(datum);
      i++; column++; // move forward to include the ending quote
      strng.location = new Location(sCol, sLine, iStart, i-iStart);
      return strng;
    }

    // readPoundSExp : String Number -> SExp
    // reads a sexp begining with a # sign.
    function readPoundSExp(str, i) {
      var sCol = column, sLine = line, iStart = i, datum;
      i++; column++; // skip over the pound sign
      // Check specially for vector literals, matching #n[...]
      var vectorMatch = new RegExp("([0-9]*)[\[\(\{]", "g"),
          vectorTest = vectorMatch.exec(str.slice(i));
      if(vectorTest && vectorTest[1].length > 0){
        var size = vectorTest[1],
            sexp = readList(str, i+(size.length));
        datum = new vectorExpr(sexp, size);
        datum.location = sexp.location;
        i = sexp.location.span;
        return datum;
      }
      if(i < str.length) {
        var p = str.charAt(i);
        switch(p){
          case 't':  // test for both forms of true
          case 'T':  datum = new booleanExpr("true"); i++; break;
          case 'f':  // test for both forms of false
          case 'F':  datum = new booleanExpr("false"); i++; break;
          // for comments, start reading after the semicolon
          case ';':  datum = readSExpComment(str, i+1);
                     i+= datum.location.span+1; break;
          // for all others, back up a character and keep reading
          case '\\': datum = readChar(str, i-1);
                     i+= datum.location.span-1; break;
          case '|':  datum = readMultiLineComment(str, i-1);
                     i+= datum.location.span; break;
          // if it's a number
          case 'e':
          case 'i':
          case 'b':
          case 'o':
          case 'd':
          case 'x':  datum = readSymbolOrNumber(str, i-1);
                    if(datum){ i+= datum.location.span-1; break;}
          default: throwError(new types.Message([source
                                                 , ":"
                                                 , line.toString()
                                                 , ":"
                                                 , (column-1).toString()
                                                 , ": read: bad syntax `#", p,"'"])
                              , new Location(sCol, sLine, iStart, (i-iStart)+1)
                              , "Error-GenericReadError");
         }
      } else {
          throwError(new types.Message([source
                                       , ":"
                                       , line.toString()
                                       , ":"
                                       , (column-1).toString()
                                       , ": read: bad syntax `#'"])
                    , new Location(sCol, sLine, iStart, i-iStart)
                    , "Error-GenericReadError");
      }
                            console.log(3);
      datum.location = new Location(sCol, sLine, iStart, i-iStart);
      return datum;
    }

    // readChar : String Number -> types.char
    // reads a character encoded in the string and returns a representative datum
    function readChar(str, i) {
      var sCol = column, sLine = line, iStart = i;
      i+=2;  column+=2; // skip over the #\\
      var datum = "";
      while(i < str.length && !isDelim(str.charAt(i)) && !isWhiteSpace(str.charAt(i))) {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        else { column++; }
        datum += str.charAt(i++);
        column++;
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
                          datum.length === 1   ? datum :
                            throwError(new types.Message(["read: Unsupported character: #\\",datum]),
                                       new Location(sCol, sLine, iStart, i-iStart));
      var chr = new charExpr(datum);
      chr.location = new Location(sCol, sLine, iStart, i-iStart);
      return chr;
    }

    // readMultiLineComment : String Number -> Atom
    // reads a multiline comment
    function readMultiLineComment(str, i) {
      var sCol = column, sLine = line, iStart = i;
      i+=2; // skip over the #|
      column+=2;
      var txt = "";
      while(i+1 < str.length && !(str.charAt(i) === '|' && str.charAt(i+1) === '#')) {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        txt+=str.charAt(i);
        i++; column++;
      }
      if(i+1 >= str.length) {
        throwError(new types.Message(["read: Unexpected EOF when reading a multiline comment"])
                   ,new Location(sCol, sLine, iStart, i-iStart));
      }
      var atom = new Comment(txt);
      atom.location = new Location(sCol, sLine, iStart, i+2-iStart);
      return atom;
    }

    // readSExpComment : String Number -> Atom
    // reads exactly one SExp and ignores it entirely
    function readSExpComment(str, i) {
      var sCol = column, sLine = line;
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
      i++; // skip over the ;
      column++;
      var txt = "";
      while(i < str.length && str.charAt(i) !== '\n') {
        // track column values while we scan
        column++;
        txt+=str.charAt(i);
        i++;
      }
      if(i > str.length) {
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
                            console.log('reading quote');
      var sCol = column, sLine = line, iStart = i;
      var p = str.charAt(i);
      var symbol = p == "'" ? new symbolExpr("quote") :
                   p == "`" ? new symbolExpr("quasiquote") :
                   "";
      if(i+1 >= str.length) {
          throwError(new types.Message([source
                                        , ":"
                                        , sLine.toString()
                                        , ":"
                                        , sCol.toString()
                                        , ": read: expected an element for quoting "
                                        , str.charAt(i)
                                        , " (found end-of-file)"])
                     , new Location(sCol, sLine, iStart, i-iStart+1)
                     , "Error-GenericReadError");
      }
      if(p == ',') {
        if(str.charAt(i+1) == '@') {
          i++;
          symbol = new symbolExpr("unquote-splicing");
        } else {
          symbol = new symbolExpr("unquote");
        }
      }
      // read what comes next, then extract it's offset and span to generate the quoted span
      var sexp = readSExpByIndex(str, i+1),
          quotedSexp = [symbol, sexp],
          quotedSpan = (sexp.location.offset + sexp.location.span) - iStart;
      
      quotedSexp.location = new Location(sCol, sLine, iStart, quotedSpan);
      return quotedSexp;
    }
                   
    // readSymbolOrNumber : String Number -> symbolExpr | types.Number
    // reads any number or symbol
    function readSymbolOrNumber(str, i) {
      var sCol = column, sLine = line, iStart = i;
      var p = str.charAt(i), datum = "";

      // snip off the next token, and let's analyze it...
      while(i < str.length && isValidSymbolCharP(str.charAt(i))) {
           // check for newlines
           if(str.charAt(i) === "\n"){ line++; column = 0;}
           datum += str.charAt(i++);
           column++;
      }

      // attempt to parse using jsnums.fromString(), assign to sexp and add location
      // if it's a bad number, throw an error
      try{
        var numValue = jsnums.fromString(datum);
        if(numValue || numValue === 0){ // don't interpret zero as 'false'
          var sexp = new numberExpr(numValue);
          sexp.location = new Location(sCol, sLine, iStart, i-iStart);
          return sexp;
        } else {
          // if it was never a number (or turned out not to be), return the Symbol
          var symbl = readSymbol(str,i,datum);
          return symbl;
        }
      // if it's not a number
      } catch(e) {
          throwError(new types.Message([source
                                        , ":"
                                        , sLine.toString()
                                        , ":"
                                        , sCol.toString()
                                        , ": read: "+e.message])
                     , new Location(sCol, sLine, iStart, i-iStart)
                     , "Error-GenericReadError");
      }
     }

    // readSymbol : String Number String -> symbolExpr
    // reads in a symbol which can be any character except for certain delimiters
    // as described in isValidSymbolCharP
    function readSymbol(str, i, datum) {
      var sCol = column-datum.length, sLine = line, iStart = i-datum.length, symbl;
      // if we're escaping, move forward one character *no matter what*
      if(datum === "\\") {
          datum += str.charAt(++i);
          column++;
      }
      while(i < str.length && isValidSymbolCharP(str.charAt(i))) {
        // if there's an escape, read the escape *and* the next character
        if(str.charAt(i) === "\\"){
          datum += str.charAt(++i);
          datum += str.charAt(++i);
          column+=2;
        } else if(str.charAt(i) === "|") {
          var sym = readVerbatimSymbol(str, i, datum);
          datum = sym.val;
          i = sym.location.i;
        } else {
          datum += str.charAt(++i);
          column++;
        }
      }

      if((i >= str.length) && (datum === "")) {
        throwError(new types.Message(["read: Unexpected EOF while reading a symbol"])
                  ,new Location(sCol, sLine, iStart, i-iStart));
      }

      var p = str.charAt(i);

      symbl = (datum==="true" || datum==="false")? new booleanExpr(datum) : new symbolExpr(datum);
      symbl.location = new Location(sCol, sLine, iStart, i-iStart);
      return symbl;
    }

    // readVerbatimSymbol : String Number String -> symbolExpr
    // reads the next couple characters as is without any restraint until it reads
    // a |.  It ignores both the closing | and the opening |.
    function readVerbatimSymbol(str, i, datum) {
      var sCol = column-datum.length, sLine = line, iStart = i-datum;
      i++; // skip over the opening |
      while(i < str.length && str.charAt(i) !== "|") {
        // check for newlines
        if(str.charAt(i) === "\n"){ line++; column = 0;}
        datum += str.charAt(i++);
        column++;
      }

      if(i >= str.length) {
        throwError(new types.Message(["Unexpected EOF while reading a verbatim symbol: ", datum])
                   ,new Location(sCol, sLine, iStart, i-iStart));
      }

      i++; // skip over the closing |
      symbl = (datum==="true" || datum==="false")? new booleanExpr(datum) : new symbolExpr(datum);
      symbl.location = new Location(sCol, sLine, iStart, i-iStart);
      return symbl;
    }

    /////////////////////
    /* Export Bindings */
    /////////////////////

    window.readFile = readSSFile;
    window.lex = readProg;
    window.sexpToString = sexpToString;
    window.read = readSExp;

})();