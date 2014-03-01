/*global goog,easyXDM*/
/*jslint browser: true, vars: true, white: true, plusplus: true, maxerr: 50, indent: 4 */

goog.provide("plt.wescheme.RoundRobin");


(function() {
    "use strict";
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


    // Try using server n to compile the expression.  If network
    // failure occurs, try the next one in round-robin order, up
    // to liveServers.length tries.
    var tryServerN = function(n, countFailures, 
                              programName, code, 
                              onDone, onDoneError) {
       // we test until there's a discrepancy
       var TEST_LOCAL = true;
 
       // try client-side parsing first
       try{
          var sexp, AST, ASTandPinfo, local_error = false,
              lexTime = 0, parseTime = 0, desugarTime = 0, analysisTime = 0;
          try { //////////////////// LEX ///////////////////
            console.log("// LEXING: ///////////////////////////////////\nraw:");
            var start = new Date().getTime(),
                sexp = lex(code, programName),
                end = new Date().getTime();
            lexTime = Math.floor(end-start);
            console.log(sexp);
            console.log("Lexed in "+lexTime+"ms");
          } catch(e) {
            var end = new Date().getTime();
                lexTime = Math.floor(end-start);
            console.log("LEXING ERROR");
            throw e;
          }
          try{ //////////////////// PARSE ///////////////////
            console.log("// PARSING: //////////////////////////////////\nraw:");
            var start = new Date().getTime(),
                AST = parse(sexp);
                end = new Date().getTime();
            parseTime = Math.floor(end - start);
            console.log(AST);
            console.log("Parsed in "+parseTime+"ms");
          } catch(e) {
            var end = new Date().getTime();
            parseTime = Math.floor(end - start);
            console.log("PARSING ERROR");
            throw e;
          }
/*
          try { ////////////////// DESUGAR /////////////////////
            console.log("// DESUGARING: //////////////////////////////\nraw");
            var start = new Date().getTime(),
                ASTandPinfo = desugar(AST),
                program = ASTandPinfo[0],
                pinfo = ASTandPinfo[1],
                end = new Date().getTime();
            desugarTime = Math.floor(end-start);
            console.log(program);
            console.log("Desugared in "+desugarTime+"ms");
            console.log("pinfo:");
            console.log(pinfo);
          } catch (e) {
            var end = new Date().getTime();
            desugarTime = Math.floor(end-start);
            console.log("DESUGARING ERROR");
            throw e;
          }
          try {
            console.log("// ANALYSIS: //////////////////////////////\n");
            var start = new Date().getTime();
            window.pinfo = analyze(program);
            var end = new Date().getTime(),
            analysisTime = Math.floor(end-start);
            console.log("Analyzed in "+analysisTime+"ms. pinfo bound to window.pinfo");
          } catch (e) {
            var end = new Date().getTime(),
            analysisTime = Math.floor(end-start);
            console.log("ANALYSIS ERROR");
            throw e;
          }
 */
      } catch (e) {
          //  for now we merely parse and log the local error -- don't do anything with it (YET)!
          local_error = e;
          // onDoneError(local_error);
      }
      var localTime = lexTime+parseTime+desugarTime+analysisTime;
      console.log("// SUMMARY: /////////////////////////////////\n"
                  + "Lexing:     " + lexTime    + "ms\nParsing:    " + parseTime + "ms\n"
                  + "Desugaring: " + desugarTime + "ms\nAnalysis:   " + analysisTime + "ms\n"
                  + "TOTAL:      " + localTime +"ms");
        // hit the server
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
                    console.log("Server round-trip in "+serverTime+"ms. Local compilation was "+factor+"x faster");
                    if(TEST_LOCAL && local_error){
//                      TEST_LOCAL = false; // turn off local testing
                      console.log("FAIL: LOCAL RETURNED AN ERROR, SERVER DID NOT");
                      logResults(code, JSON.stringify(local_error), "NO SERVER ERROR");
                    }
                    console.log("OK: LOCAL AND SERVER BOTH PASSED");
                    onDone(bytecode);
                },
                // wrap onDoneError() with a function to compare local and server output
                function(errorStruct) {
                    var end = new Date().getTime(),
                        serverTime = Math.floor(end-start),
                        factor =  Math.ceil(100*serverTime/localTime)/100;
                    console.log("Server round-trip in "+serverTime+"ms. Local compilation was "+factor+"x faster");
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
                    } else if(TEST_LOCAL){
                        if(!local_error){
//                          TEST_LOCAL = false; // turn off local testing
                          console.log("FAIL: SERVER RETURNED AN ERROR, LOCAL DID NOT");
                          logResults(code, "NO LOCAL ERROR", JSON.stringify(errorStruct.message));
                        }
                        // if the results are different, we should log them to the server
                        else if(!sameResults(JSON.parse(local_error), JSON.parse(errorStruct.message))){
//                            TEST_LOCAL = false; // turn off local testing
                            console.log("FAIL: LOCAL AND SERVER RETURNED DIFFERENT ERRORS");
                            logResults(code, JSON.stringify(local_error), JSON.stringify(errorStruct.message));
                        }
                        else {
                          console.log("OK: LOCAL AND SERVER BOTH RETURNED THE SAME ERROR");
                        }
                        onDoneError(errorStruct.message);
                    }
                });
        } else {
            onAllCompilationServersFailing(onDoneError);
        }
    };
 
    // sameResults : local server -> boolean
    // compare entities using a 3-step process
    // 1) Weak comparison on locations
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
      console.log('Error messages differed. Logging anonymized error message to GDocs');
      document.getElementById('expr').value = code;
      document.getElementById('local').value = local.replace(/\s+/g,"").toLowerCase();
      document.getElementById('server').value = server.replace(/\s+/g,"").toLowerCase();
      document.getElementById('errorLogForm').submit();
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
