/*global goog,easyXDM*/
/*jslint browser: true, vars: true, white: true, plusplus: true, maxerr: 50, indent: 4 */

goog.provide("plt.wescheme.RoundRobin");


(function() {
    "use strict";
 
    if(!console) {console={}; console.log = function(){};}
    //////////////////////////////////////////////////////////////////////



    // Initializes the remote procedure call between the client and
    // the given serverUrl.  Due to the peculiarities of easyXDM, we
    // need to ping the server up front to see if the connection is
    // alive: we don't get a reliable error exception if the server is
    // down from the very beginning.
    var initializeServer = function(serverUrl, afterInitialize) {
        var xhr = new easyXDM.Rpc(
            { remote: serverUrl,
              // This lazy flag must be set to avoid a very ugly
              // issue with Firefox 3.5.
              lazy: true
            }, 
            { remote: { compileProgram: {} }});
        // We initiate compilation of the empty program and see
        // if the server responds.  If it does, we add the server
        // to the list of known good servers.
        var startTime = new Date();
        xhr.compileProgram("", 
                           "",
                           function(bytecode) {
                               liveServers.push( { xhr : xhr,
                                                   url : serverUrl,
                                                   pingDelay : (new Date() - startTime) } );
                               if (! AT_LEAST_ONE_SERVER_READY) {
                                   AT_LEAST_ONE_SERVER_READY = true;
                                   afterInitialize();
                               }
                               // Sort the servers in ascending pingDelay.
                               liveServers.sort(
                                   function(x, y) {
                                       if (x.pingDelay < y.pingDelay) { 
                                           return -1;
                                       }
                                       if (x.pingDelay > y.pingDelay) {
                                           return 1;
                                       }
                                       return 0;
                                   });
                           },
                           function(err) {
                               if (err.status == 503) {
                                   initializeServer(serverUrl, afterInitialize);
                               }
                           });
    };


    var liveServers = [];

    var AT_LEAST_ONE_SERVER_READY = false;
    var initialize = function(compilation_servers, afterInitialize, onFailure) {
        if (AT_LEAST_ONE_SERVER_READY) {
            afterInitialize();
        } else {
            setTimeout(function() {
                if (! AT_LEAST_ONE_SERVER_READY) {
                    onFailure();
                }
            }, 10000);


            // Configures the evaluator to use round-robin compilation between
            // a set of servers.  Compilation will also fall back to other
            // servers under network failure.
            var i;
            for (i = 0; i < compilation_servers.length; i++) {
                initializeServer(compilation_servers[i], afterInitialize);
            }
        }
    };


    // Resets the round robin servers to the initial state.  Use
    // initialize() to reconfigure.
    var reset = function() {
        AT_LEAST_ONE_SERVER_READY = false;
        liveServers = [];
    };





    var onAllCompilationServersFailing = function(onDoneError) {
        // If all servers are failing, we simulate a 
        // compile time error with the following content:
        onDoneError(
            JSON.stringify(
                "WeScheme appears to be busy or unavailable at this time." +
                "  Please check your network settings, or again later."));
    };

    function writeLocalCompilerCookie(using) {
      var date = new Date();
      date.setTime(date.getTime()+(.50*60*60*1000)); // expire in half an hour
      var expires = "; expires="+date.toGMTString();
      document.cookie = 'use_local_compiler'+"="+using+expires+"; path=/";
      return using;
    };

    function readLocalCompilerCookie() {
      var nameEQ = 'use_local_compiler' + "=";
      var ca = document.cookie.split(';');
      for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
      }
      return null;
    };
 
     // check to make sure it's JSON parseable before returning it.
     function getError(e){
      try{
        var err =  JSON.parse(e),
        structuredErr = JSON.parse(err['structured-error']);
        return e;
      } catch (JSONerror){
        writeLocalCompilerCookie("false"); // if the local compiler crashes, turn it off
        return "!! FATAL ERROR !!\n on "+(plt.wescheme.BrowserDetect.versionString)+'\n'+e.stack;
      }
    }


    // Try using server n to compile the expression.  If network
    // failure occurs, try the next one in round-robin order, up
    // to liveServers.length tries.
    var tryServerN = function(n, countFailures, 
                              programName, code, 
                              onDone, onDoneError) {

       // strip out nonbreaking whitespace chars from the code
       code = code.replace(/[\uFEFF\u2060\u200B]/,'');

       // get an array of charCodes for all non-ascii chars in a string
       function getHigherThanAsciiChars(str){
          var nonASCII = str.split("").filter(function(c) { return (c.charCodeAt(0) > 127); });
          return nonASCII.map(function(c) { return c.charCodeAt(0);});
       }
 
       // if no cookie exists, set it to true
       if(readLocalCompilerCookie()===null) writeLocalCompilerCookie("true");
       // turn on local testing if the cookie is true *and* if we have the error logging form in place
       var TEST_LOCAL = document.getElementById('errorLogForm') && readLocalCompilerCookie() === "true";

       // Is it a MWF?
       var TEST_DAY = (new Date().getDay() % 2)==1;
 
       // How much do we trust the local compiler to run without a server safety-net? (0.00-1.00)
       var TRUST_LOCAL_ERRORS   = (Math.random() < 0.90) && TEST_DAY,
           TRUST_LOCAL_BYTECODE = (Math.random() < 0.90) && TEST_DAY;
 
       console.log('Local compiler is '+(TEST_LOCAL? '' : 'not')+' running\nTEST_DAY is '+TEST_DAY
                  +'\nTRUST_LOCAL_ERRORS is '+TRUST_LOCAL_ERRORS+'\nTRUST_LOCAL_BYTECODE is '+TRUST_LOCAL_BYTECODE);
 
 if(TEST_LOCAL){
       var local_error = false, local_bytecode = false, start = new Date().getTime();
       // try client-side compilation first
       try{
          var lexemes     = plt.compiler.lex(code, programName);
          var AST         = plt.compiler.parse(lexemes);
          var desugared   = plt.compiler.desugar(AST)[0];  // includes [AST, pinfo]
          var pinfo       = plt.compiler.analyze(desugared);
          local_bytecode  = plt.compiler.compile(desugared, pinfo);

          // if we're trusting local bytecodes, execute and return without hitting the server
          if(TRUST_LOCAL_BYTECODE){
            console.log('Trusting locally-generated bytecode');
            onDone(JSON.stringify(local_bytecode));
            return;
          }
      } catch (e) {
          local_error = getError(e).toString();
          // if it's a fatal error, shut off the local compiler, log the error and move on
          if(/FATAL ERROR/.test(local_error.toString())){
            writeLocalCompilerCookie("false");
            logResults(code, JSON.stringify(local_error), "FATAL ERROR");
          // if we're trusting local errors, return without hitting the server
          } else if(TRUST_LOCAL_ERRORS){
            console.log('Trusting locally-generated error');
            onDoneError(local_error);
            return;
          }
      }
      // if we're going out to the server, track the time for speed comparison
      var end         = new Date().getTime(), localTime   = Math.floor(end-start);
      console.log("Compiled in: " + Math.floor(end-start) +"ms");
 }
 
        // if there's no error, or if we don't trust the local compiler's output, hit the server
        var start = new Date().getTime();
        if (n < liveServers.length) {
            liveServers[n].xhr.compileProgram(
                programName,
                code,
                // wrap onDone() with a function to compare local and server output
                function(bytecode){
                    var end = new Date().getTime(),
                        serverTime = Math.floor(end-start),
                        factor =  Math.ceil(100*serverTime/localTime)/100;
                    // If the local compiler is running, check to see that no errors were generated
                    if(TEST_LOCAL){
                       console.log("Server round-trip in "+serverTime+"ms. Local compilation was "+factor+"x faster");
                       if(local_error){
                         console.log("FAIL: LOCAL RETURNED AN ERROR, SERVER DID NOT");
                         logResults(code, JSON.stringify(local_error), "NO SERVER ERROR");
                       } else {
                         console.log("OK: LOCAL AND SERVER BOTH PASSED");
                       }
                       // compare bytecodes for accuracy
                       var server_bytecode = JSON.parse(bytecode);
              if(Math.random() < .50){ // 50% of the time, we'll compare the actual bytecodes
                       if(!sameResults( (0,eval)('('+local_bytecode.bytecode+')'),
                                        (0,eval)('('+server_bytecode.bytecode+')'))){
                          nonASCIIcodes = getHigherThanAsciiChars(code).join(",");
                          console.log("FAIL: LOCAL RETURNED DIFFERENT BYTECODE FROM SERVER");
                          logResults(code, plt.wescheme.BrowserDetect.versionString, "BYTECODES_DIFFERED. NonASCII codes were "+nonASCII);
                       } else {
                          console.log("OK: LOCAL RETURNED EQUIVALENT BYTECODE AS THE SERVER");
                       }
              }
                    }
                                              
                    // execute server bytecode
                    onDone(bytecode);
 
                },
                // wrap onDoneError() with a function to compare local and server output
                function(errorStruct) {
                    var end = new Date().getTime(),
                        serverTime = Math.floor(end-start),
                        factor =  Math.ceil(100*serverTime/localTime)/100;
                    // If we get a 503, just try again.
                    if (errorStruct.status == 503) {
                        tryServerN(n,
                                   countFailures,
                                   programName,
                                   code,
                                   onDone,
                                   onDoneError);
                    }                    
                    // If the content of the message is the
                    // empty string, communication with
                    // the server failed.
                    else if (errorStruct.message === "") {
                        if (countFailures >= liveServers.length) {
                            onAllCompilationServersFailing(onDoneError);
                        } else {
                            tryServerN(((n + 1) % liveServers.length),
                                       countFailures + 1,
                                       programName,
                                       code,
                                       onDone,
                                       onDoneError);
                        }
                    // If the local compiler is running, compare the results
                    } else if(TEST_LOCAL){
                        console.log("Server round-trip in "+serverTime+"ms. Local compilation was "+factor+"x faster");
                        if(!local_error){
                          console.log("FAIL: SERVER RETURNED AN ERROR, LOCAL DID NOT");
                          logResults(code, "NO LOCAL ERROR", JSON.stringify(errorStruct.message));
                        }

                        var localJSON;
                        try{
                          var localJSON = JSON.parse(JSON.parse(local_error)["structured-error"]),
                              serverJSON = JSON.parse(JSON.parse(errorStruct.message)["structured-error"]);
                          // if it's not a known-better error, and if the results are different, we should log them to the server
                          if(//(localJSON.betterThanServer===undefined || !localJSON.betterThanServer) &&
                             !sameResults(localJSON, serverJSON)){
                              console.log("FAIL: LOCAL RETURNED DIFFERENT ERROR FROM SERVER");
                              logResults(code, JSON.stringify(local_error), JSON.stringify(errorStruct.message));
                          } else {
                            console.log("OK: LOCAL RETURNED THE SAME (OR BETTER) ERROR AS SERVER");
                          }
                        } catch (e) {
                          logResults(code, local_error, JSON.stringify(errorStruct.message));
                        }
                    }
                    // use the server compiler's error message
                    onDoneError(errorStruct.message);

                });
        } else {
            onAllCompilationServersFailing(onDoneError);
        }
    };
 
// dictionaries of toplevel names for x and y bytecodes
var x_toplevels = [], y_toplevels = [],
  extractTopLevelName = function (tl){
      if(!tl) return false;
      if(tl.$ === 'global-bucket') return tl.value;
      if(tl.$ === 'module-variable') return tl.sym.val+tl.modidx.path;
      else throw "UNKNOWN TOPLEVEL TYPE: "+tl.toString();
}

  
// sameResults : local server -> boolean
// Weak comparison on locations, indirect comparison for toplevel references
// Recursive comparison for objects
// Strong comparison for literals
// if there's a difference, log a diff to the form and return false
// credit to: http://stackoverflow.com/questions/1068834/object-comparison-in-javascript
function sameResults(x, y){
 
  // given an object, remove empty properties and reconstruct as an alphabetized JSON string
  // then parse and return a canonicalized object
  function canonicalizeObject(obj){
    var fields = [], obj2={};
    for (i in obj) { if (obj.hasOwnProperty(i) && obj[i] !== "") fields.push(i); }
    fields.sort();
    for (var i=0;i<fields.length; i++) { obj2[fields[i]] = obj[fields[i]]; }
    return obj2;
  }
  
  function canonicalizeLiteral(lit){
    return lit.toString().replace(/\s*/g,"");
  }

  // if either one is an object, canonicalize it
  if(typeof(x) === "object") x = canonicalizeObject(x);
  if(typeof(y) === "object") y = canonicalizeObject(y);

  // 1) if both are Locations, we only care about startChar and span, so perform a weak comparison
  if ( x.hasOwnProperty('offset') && y.hasOwnProperty('offset') ){
    return ( (x.span == y.span) && (x.offset == y.offset) );
  }
  // 2) if both objects have a prefix field, build our dictionaries *before* moving on
  if(x.hasOwnProperty('prefix') && y.hasOwnProperty('prefix')){
    x_toplevels = x.prefix.toplevels.map(extractTopLevelName);
    y_toplevels = y.prefix.toplevels.map(extractTopLevelName);
  }
  // 3) if they are both objects, compare each property
  if(typeof(x)=="object" && typeof(x)=="object"){
    // does every property in x also exist in y?
    for (var p in x) {
      // don't log an error for things that identical save for "betterThanServer"
      if(p==="betterThanServer") continue;
 
      // log error if a property is not defined
      if ( ! x.hasOwnProperty(p) ){ console.log('local lacks a '+p); return false; }
      if ( ! y.hasOwnProperty(p) ){ console.log('server lacks a '+p); return false; }
      // ignore the hashcode property
      if(p==="_eqHashCode") continue;
      // toplevel properties are equal if the sets of names are equal
      // WARNING: this may require stronger checking!
      if(p==="toplevels"){
        // if they're not the same length, bail
        if(x_toplevels.length !== y_toplevels.length){
          console.log('different number of toplevels'); return false;
        }
        // if they're not the same names, bail
        if(!x_toplevels.every(function(v,i) { return y_toplevels.indexOf(v) > -1;})){
          console.log('different toplevel names'); return false;
        }
        // build sorted lists of all module variables, return true if they are identical
        var x_modVariables = x.toplevels.filter(function(tl){return tl.$==="module-variable"}).map(extractTopLevelName),
            y_modVariables = y.toplevels.filter(function(tl){return tl.$==="module-variable"}).map(extractTopLevelName);
        x_modVariables.sort();
        y_modVariables.sort();
        return sameResults(x_modVariables, y_modVariables);
      }
      // use pos's as keys into the toplevel dictionaries, and compare their values
      if((p==="pos") && (x["$"]==="toplevel") && (x["$"]==="toplevel")){
        if(x_toplevels[Number(x[p])] === y_toplevels[Number(y[p])]){ continue; }
        else { console.log('different indices for '+x_toplevels[Number(x[p])]); return false; }
      }
      // if they both have the property, compare it
      if(sameResults(x[p],y[p])) continue;
      else{ return false;}
    }
    // does every property in y also exist in x?
    for (p in y) {
      // log error if a property is not defined
      if ( y.hasOwnProperty(p) && !x.hasOwnProperty(p) ){ return false; }
    }
  // 4)if they are literals, they must be identical
  } else {
      if (canonicalizeLiteral(x) !== canonicalizeLiteral(y)){
        console.log('(local, server) literals not the same:\n'+x+'\nis not equal to \n'+y);
        return false;
      }
  }
  return true;
}
    // logResults : code local server -> void
    // send code, local error and server error to a Google spreadsheet
    function logResults(code, local, server){
       try{
            console.log('Logging anonymized error message to GDocs');
            document.getElementById('expr').value = code;
            document.getElementById('local').value = local.replace(/\s+/g,"").toLowerCase();
            document.getElementById('server').value = server.replace(/\s+/g,"").toLowerCase();
            document.getElementById('errorLogForm').submit();
       } catch (e){
          console.log('LOGGING FAILED. Turning off Local Compiler.');
          writeLocalCompilerCookie("false");
       }
    }

    // TODO: add a real LRU cache for compilations.
    // The following does a minor bit of caching for the very
    // last compilation.
    var lastCompiledName = null;
    var lastCompiledCode = null;
    var lastCompiledResult = null;

    // The name "round-robin" is historical: we really contact the
    // servers in order, starting from liveServers[0], liveServers[1], ...
    var roundRobinCompiler = 
        function(programName, code, onDone, onDoneError) {
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


            if (liveServers.length > 0) {
                tryServerN(0, 0,
                           programName, code, onDoneWithCache, onDoneError);
            } else {
                onAllCompilationServersFailing(onDoneError);
            }
        };

    //////////////////////////////////////////////////////////////////////

    plt.wescheme.RoundRobin.initialize = initialize;
    plt.wescheme.RoundRobin.roundRobinCompiler = roundRobinCompiler;

    
    // The following exports are for debugging purposes.
    plt.wescheme.RoundRobin.reset = reset;
    plt.wescheme.RoundRobin.liveServers = liveServers;
}());
