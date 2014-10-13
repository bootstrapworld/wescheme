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
                "  Please try again later."));
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
 
       // if no cookie exists, set it to true
       if(readLocalCompilerCookie()===null) writeLocalCompilerCookie("true");
       // turn on local testing if the cookie is true *and* if we have the error logging form in place
       var TEST_LOCAL = document.getElementById('errorLogForm') && readLocalCompilerCookie() === "true";
       // How much do we trust the local compiler to run without a server safety-net? (0.00-1.00)
       var TRUST_LOCAL = 0.50;
       // Is it an odd-numbered day?
       var TEST_DAY = (new Date().getDay() % 2)==1;
 
       console.log('TEST_LOCAL is '+TEST_LOCAL+'\nTEST_DAY is '+TEST_DAY+'\nTRUST_LOCAL is '+TRUST_LOCAL);
 
 if(TEST_LOCAL){
       // Be conservative, and shut off the local compiler for future requests
       // This allows us to gracefully recover from a browser-hanging bug
       writeLocalCompilerCookie("false");
       var local_error = false, start = new Date().getTime();

       // try client-side compilation first
       try{
          var lexemes     = plt.compiler.lex(code, programName);
          var AST         = plt.compiler.parse(lexemes);
          var desugared   = plt.compiler.desugar(AST)[0];
          var pinfo       = plt.compiler.analyze(desugared);
          var bytecode    = plt.compiler.compile(desugared, pinfo);
      } catch (e) {
          local_error = getError(e).toString();
      }
      var end         = new Date().getTime(), localTime   = Math.floor(end-start);
 
      // we made it out alive, so we can keep the local compiler on
      writeLocalCompilerCookie("true");
      console.log("Compiled in: " + Math.floor(end-start) +"ms");
 
      // At this point, the local compiler front-end has completed. If...
      if( local_error                                                   // (1) it returned an error
          && !(/FATAL ERROR/.test(local_error.toString()))              // (2) the error was non-fatal
          && TEST_DAY                                                   // (3) it's a test day
          && (Math.random() > TRUST_LOCAL) ) {                          // (4) it's being trusted
        // Produce the error without ever bothering the server
        console.log('returning local error without ever hitting the server.');
        onDoneError(local_error);
        return;
      }
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
                    }
                    // execute server bytecode
                    onDone(bytecode);

                    // execute using locally-compiled bytecodes!!
//                    try{ console.log('EXECUTING LOCAL BYTECODES!!!'); onDone(JSON.stringify(bytecode));}
//                    catch(e){console.log(e);}
 
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
                          localJSON = JSON.parse(local_error);
                        
                          // if it's not a known-better error, and if the results are different, we should log them to the server
                          if(//(localJSON.betterThanServer===undefined || !localJSON.betterThanServer) &&
                             !sameResults(localJSON, JSON.parse(errorStruct.message))){
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
 
    // sameResults : local server -> boolean
    // compare entities using a 3-step process
    // 1) Weak comparison on locations and toplevels
    // 2) Recursive comparison for objects
    // 3) Strong comparison for literals
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
 
      function saveDiffAndReturn(x, y){
        var local = (x instanceof Object)? JSON.stringify(x) : x.toString(),
            server= (y instanceof Object)? JSON.stringify(y) : y.toString();
        local.replace(/\s/,"").replace("\\","");
        server.replace(/\s/,"").replace("\\","");
        document.getElementById('diffString').value = "LOCAL: "+local+"\nSERVER: "+server;
        return false;
      }
 
      // if either one is a JSON string, convert it to an object
      try{ var x = JSON.parse(x); }
      catch(e) { /* if it doesn't parse correctly, proceed silently */ }
      try{ var y = JSON.parse(y);}
      catch(e) { /* if it doesn't parse correctly, proceed silently */ }

      // if either one is an object, canonicalize it
      if(typeof(x) === "object") x = canonicalizeObject(x);
      if(typeof(y) === "object") y = canonicalizeObject(y);

      // 1) if both are Locations, we only care about offset and span, so perform a weak comparison
      if ( x.hasOwnProperty('offset') && y.hasOwnProperty('offset') ){
        if( (x.span !== y.span) || (x.offset !== y.offset) ){
          console.log('FAIL: locations are not equal');
          return saveDiffAndReturn(x, y);
        }
      // 2) if they are both objects, compare each property
      } else if(typeof(x)=="object" && typeof(x)=="object"){
        // does every property in x also exist in y?
        for (var p in x) {
 
          // for now, we ignore 'betterThanServer'
          if(p === 'betterThanServer') continue;
 
          // log error if a property is not defined
          if ( ! x.hasOwnProperty(p) ){
            console.log('FAIL: x doesn\'t have property '+p);
            return saveDiffAndReturn(p+":undefined", y[p]);
          }
          if ( ! y.hasOwnProperty(p) ){
            console.log('FAIL: y doesn\'t have property '+p);
            return saveDiffAndReturn(x[p],          p+":undefined");
          }
 
          // if they both have the property, compare it
          if(sameResults(x[p],y[p])) continue;
          // if there's a difference, return false
          else return false;
        }
        // does every property in y also exist in x?
        for (p in y) {
          // for now, we ignore 'betterThanServer'
          if(p === 'betterThanServer') continue;
 
          // log error if a property is not defined
          if ( y.hasOwnProperty(p) && !x.hasOwnProperty(p) ){
            console.log('FAIL: x doesn\'t have property '+p);
            return saveDiffAndReturn(p+":undefined",y[p]);
          }
        }
      // 3)if they are literals, they must be identical
      } else {
          // if both x and y are null or undefined and exactly the same
          if (x !== y){
            console.log('FAIL: literals are not the same: '+x+' and '+y);
            return saveDiffAndReturn(x,y);
          }
      }
      return true;
    }
 
    // logResults : code local server -> void
    // send code, local error and server error to a Google spreadsheet
    function logResults(code, local, server){
       try{
            console.log('Error messages differed. Logging anonymized error message to GDocs');
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
