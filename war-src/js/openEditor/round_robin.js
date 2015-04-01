/*global goog,easyXDM*/
/*jslint browser: true, vars: true, white: true, plusplus: true, maxerr: 50, indent: 4 */

goog.provide("plt.wescheme.RoundRobin");

goog.require('plt.compiler.lex');
goog.require('plt.compiler.parse');
goog.require('plt.compiler.desugar');
goog.require('plt.compiler.analyze');
goog.require('plt.compiler.compile');

(function() {
    "use strict";
 
    if(!console) {console={}; console.log = function(){};}
    //////////////////////////////////////////////////////////////////////

    // this function is now obsolete - all it does is pretend a server was found,
    // since we now
    var initialize = function(compilation_servers, afterInitialize, onFailure) {
        afterInitialize();
    };

    var onCompilationFail = function(onDoneError) {
        // If all servers are failing, we simulate a 
        // compile time error with the following content:
        onDoneError(
            JSON.stringify(onDoneError("The local compiler has failed to run properly. "
                                       + "You may want to confirm that you are running "
                                       + "a modern web browser (IE9+, Safari 6+, FF 20+, "
                                       + "Chrome 20+).")));
    };
 
    // check to make sure it's JSON parseable before returning it.
     function getError(e){
      try{
        var err =  JSON.parse(e),
        structuredErr = JSON.parse(err['structured-error']);
        return e;
      } catch (JSONerror){
        return "!! FATAL ERROR !!\n"+e.stack;
      }
    }
    // logResults : code local server -> void
    // send code, local error and server error to a Google spreadsheet
    function logResults(code, local, server){
       try{
          console.log('Logging anonymized error message to GDocs');
          document.getElementById('expr').value = code;
          document.getElementById('local').value = plt.wescheme.BrowserDetect.versionString + " "
                                                  + local.replace(/\s+/g,"").toLowerCase();
          document.getElementById('server').value = server.replace(/\s+/g,"").toLowerCase();
          document.getElementById('errorLogForm').submit();
       } catch (e){
          console.log('LOGGING FAILED.');
       }
    }


    function compile(programName, code, onDone, onDoneError) {
       // strip out nonbreaking whitespace chars from the code
       code = code.replace(/[\uFEFF\u2060\u200B]/,'');

       // get an array of charCodes for all non-ascii chars in a string
       function getHigherThanAsciiChars(str){
          var nonASCII = str.split("").filter(function(c) { return (c.charCodeAt(0) > 127); });
          return nonASCII.map(function(c) { return c.charCodeAt(0);});
       }

      // compile it!
      try{
          var start = new Date().getTime();
          var lexemes     = plt.compiler.lex(code, programName);
          var AST         = plt.compiler.parse(lexemes);
          var desugared   = plt.compiler.desugar(AST)[0];  // includes [AST, pinfo]
          var pinfo       = plt.compiler.analyze(desugared);
          var local_bytecode  = plt.compiler.compile(desugared, pinfo);
          onDone(JSON.stringify(local_bytecode));
      } catch (e) {
          var local_error = getError(e).toString();
          // if it's a fatal error, log the error and move on
          if(/FATAL ERROR/.test(local_error.toString())){
            logResults(code, JSON.stringify(local_error), "FATAL ERROR");
            onCompilationFail(onDoneError);
          // otherwise, render the error as usual
          } else{
            onDoneError(local_error);
          }
      }
      var end         = new Date().getTime(), localTime   = Math.floor(end-start);
      console.log("Compiled in: " + Math.floor(end-start) +"ms");
    };

    // TODO: add a real LRU cache for compilations.
    // The following does a minor bit of caching for the very
    // last compilation.
    var lastCompiledName = null;
    var lastCompiledCode = null;
    var lastCompiledResult = null;

    // See if we can used a cached compilation. Otherwise, just compile
    function cachedCompilation(programName, code, onDone, onDoneError) {
      var onDoneWithCache = function() {

          // Cache the last result:
          var result = [].slice.call(arguments, 0);
          lastCompiledName = programName;
          lastCompiledCode = code;
          lastCompiledResult = result;

          return onDone.apply(null, arguments);
      };
      // run the cached bytecode from previous compilation
      if ((programName === lastCompiledName) &&
          (code === lastCompiledCode)) {
          return onDone.apply(null, lastCompiledResult);
      }
      // try to compile the program
      compile(programName, code, onDoneWithCache, onDoneError);
    };

    //////////////////////////////////////////////////////////////////////

    plt.wescheme.RoundRobin.initialize = initialize;
    plt.wescheme.RoundRobin.roundRobinCompiler = cachedCompilation;
}());