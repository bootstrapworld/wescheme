goog.provide('plt.compiler.topLevelModules');
goog.provide('plt.compiler.knownModules');
goog.provide('plt.compiler.knownCollections');

goog.require("plt.compiler.moduleBinding");
goog.require("plt.compiler.functionBinding");
goog.require("plt.compiler.constantBinding");

// if not defined, declare the compiler object as part of plt
window.plt   = window.plt   || {};
plt.compiler = plt.compiler || {};
/*
 TODO
 -
 */

//////////////////////////////////////////////////////////////////////////////
/////////////////// MODULE BINDINGS //////////////////////////
(function (){
 
  var moduleBinding   = plt.compiler.moduleBinding;
  var functionBinding = plt.compiler.functionBinding;
  var constantBinding = plt.compiler.constantBinding;
 
  // given a moduleName, return a function that converts binding specs into function bindings
  function makeFunctionBinding(modulePath){
    return function(binding){
            binding[3] = binding[3] || [];      // permissions default to none
            binding[4] = binding[4] || false;   // isCps defaults to false
            binding[5] = binding[5] || false;   // loc defaults to false
            return new functionBinding(binding[0], modulePath, binding[1], binding[2], binding[3], binding[4], binding[5]);
           };
  }
  
  // kernel-misc-module
  var kernelMiscModule  = new moduleBinding("moby/runtime/kernel/misc",
                                           [["verify-boolean-branch-value", 2]
                                            ,["throw-cond-exhausted-error", 1 ]
                                            ,["'check-operator-is-function", 3]
                                            ,["print-values", 0]
                                           ].map(makeFunctionBinding('"moby/runtime/kernel/misc"'))
  );
  
  // foreign-module
  var foreignModule     = new moduleBinding("moby/foreign",
                                           [["get-js-object", 2, false, ["android.permission.FOREIGN-FUNCTION-INTERFACE"]]
                                           ].map(makeFunctionBinding('"moby/foreign"'))
  );
  
  // world-effects-module
  var worldEffectsModule= new moduleBinding("world-effects",
                                            [["make-effect:none", 0, false]
                                             ,["make-effect:beep", 0, false, ["android.permission.VIBRATE"]]
                                             ,["make-effect:play-dtmf-tone", 2, false]
                                             ,["make-effect:send-sms", 2, false, ["android.permission.SEND-SMS"]]
                                             ,["make-effect:play-sound", 1, false, ["android.permission.INTERNET"]]
                                             ,["make-effect:stop-sound", 1, false]
                                             ,["make-effect:pause-sound", 1, false]
                                             ,["make-effect:set-sound-volume", 1, false]
                                             ,["make-effect:set-beep-volume", 1, false]
                                             ,["make-effect:raise-sound-volume", 0, false]
                                             ,["make-effect:lower-sound-volume", 1, false]
                                             ,["make-effect:set-wake-lock", 1, false, ["android.permission.WAKE-LOCK"]]
                                             ,["make-effect:release-wake-lock", 1, false, ["android.permission.WAKE-LOCK"]]
                                             ,["make-effect:pick-playlist", 1, false]
                                             ,["make-effect:pick-random", 2, false]
                                             ].map(makeFunctionBinding('"moby/world-effects"'))
  );
  
  // world-handlers-module
  var worldHandlersModule=new moduleBinding("world-config",
                                           [["on-tick", 1, true]
                                            ,["initial-effect", 1, false]
                                            ,["on-key", 1, false]
                                            ,["on-key!", 2, false]
                                            ,["on-mouse", 1, false]
                                            ,["on-tap", 1, false]
                                            ,["on-tilt", 1, false]
                                            ,["on-redraw", 1, false]
                                            ,["to-draw", 1, false]
                                            ,["on-draw", 2, false]
                                            ,["stop-when", 1, false]
                                           ].map(makeFunctionBinding('"moby/world-handlers"'))
  );
  
  // bootstrap-teachpack
  var bootstrapTeachpackFunctions = [["START", 14, false] ,["test-frame", 1, false] ,["sine", 1, false]
                                     ,["cosine", 1, false] ,["tangent", 1, false]];
  var bootstrapTeachpack = new moduleBinding("bootstrap/bootstrap-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap/bootstrap-teachpack"'))),
      bootstrapTeachpack2011 = new moduleBinding("bootstrap2011/bootstrap-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2011/bootstrap-teachpack"'))),
      bootstrapTeachpack2012 = new moduleBinding("bootstrap2012/bootstrap-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2012/bootstrap-teachpack"'))),
      bootstrapTiltTeachpack2012 = new moduleBinding("bootstrap2012/bootstrap-tilt-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2012/bootstrap-tilt-teachpack"'))),
      bootstrapTeachpack2014 = new moduleBinding("bootstrap2014/bootstrap-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2014/bootstrap-teachpack"'))),
      bootstrapTiltTeachpack2014 = new moduleBinding("bootstrap2014/bootstrap-tilt-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2014/bootstrap-tilt-teachpack"'))),
      bootstrapTeachpack2015 = new moduleBinding("bootstrap2015/bootstrap-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2015/bootstrap-teachpack"'))),
      bootstrapTiltTeachpack2015 = new moduleBinding("bootstrap2015/bootstrap-tilt-teachpack",
                                             bootstrapTeachpackFunctions.map(makeFunctionBinding('"bootstrap2015/bootstrap-tilt-teachpack"')));
 
  // cage-teachpack
  var cageTeachpack = new moduleBinding("bootstrap/cage-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap/cage-teachpack"'))),
      cageTeachpack2011 = new moduleBinding("bootstrap2011/cage-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap2011/cage-teachpack"'))),
      cageTeachpack2012 = new moduleBinding("bootstrap2012/cage-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap2012/cage-teachpack"'))),
      cageTeachpack2014 = new moduleBinding("bootstrap2014/cage-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap2014/cage-teachpack"')));
      cageTeachpack2015 = new moduleBinding("bootstrap2015/cage-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap2015/cage-teachpack"')));
  
  // boolean-teachpack (includes cage techpack code!!)
  var booleanTeachpackFunctions = [["start", 1, false], ["continent?", 1, false], ["primary-color?", 1, false], ["less-than-one?", 1, false]]
  var booleanTeachpack2020 = new moduleBinding("bootstrap2020/boolean-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap2020/boolean-teachpack"')));
 
  // function-teachpack
  var functionTeachpack = new moduleBinding("bootstrap/function-teachpack",
                                            [["start", 1, false]].map(makeFunctionBinding('"bootstrap/function-teachpack"'))),
      functionTeachpack2011 = new moduleBinding("bootstrap2011/function-teachpack",
                                                [["start", 1, false]].map(makeFunctionBinding('"bootstrap2011/function-teachpack"'))),
      functionTeachpack2012 = new moduleBinding("bootstrap2012/function-teachpack",
                                                [["start", 1, false]].map(makeFunctionBinding('"bootstrap2012/function-teachpack"'))),
      functionTeachpack2014 = new moduleBinding("bootstrap2014/function-teachpack",
                                                [["start", 1, false]].map(makeFunctionBinding('"bootstrap2014/function-teachpack"'))),
      functionTeachpack2015 = new moduleBinding("bootstrap2015/function-teachpack",
                                                [["start", 1, false]].map(makeFunctionBinding('"bootstrap2015/function-teachpack"')));
  
  // location module
  var locationModule     = new moduleBinding("location",
                                             [["get-latitude",      0, false, ["android.permission.LOCATION"]]
                                              ,["get-longitude",    0, false, ["android.permission.LOCATION"]]
                                              ,["get-altitude",     0, false, ["android.permission.LOCATION"]]
                                              ,["get-bearing",      0, false, ["android.permission.LOCATION"]]
                                              ,["get-speed",        0, false, ["android.permission.LOCATION"]]
                                              ,["location-distance", 0, false, ["android.permission.LOCATION"]]
                                              ].map(makeFunctionBinding('"moby/geolocation"'))
  );

  // accelerometer library
  var tiltModule        = new moduleBinding("tilt",
                                             [["get-x-acceleration",  0, false, ["android.permission.TILT"]]
                                              ,["get-y-acceleration", 0, false, ["android.permission.TILT"]]
                                              ,["get-z-acceleration", 0, false, ["android.permission.TILT"]]
                                              ,["get-azimuth",        0, false, ["android.permission.TILT"]]
                                              ,["get-pitch",          0, false, ["android.permission.TILT"]]
                                              ,["get-roll",           0, false, ["android.permission.TILT"]]
                                              ].map(makeFunctionBinding('"moby/tilt"'))
  );

  // telephony module
  var telephonyModule    = new moduleBinding("telephony",
                                             [["get-signal-strength",  0, false, ["android.permission.TELEPHONY"]]
                                             ].map(makeFunctionBinding('"moby/net"'))
  );

  // net module
  var netModule         = new moduleBinding("net",
                                             [["get-url",  1, false, ["android.permission.INTERNET"]]
                                             ].map(makeFunctionBinding('"moby/net"'))
  );
                                              
  // parser module
  var parserModule      = new moduleBinding("parser",
                                             [["xml->s-sexp",  1, false]
                                             ].map(makeFunctionBinding('"moby/parser"'))
  );

  // js-world module
  var jsWorldModule     = new moduleBinding("jsworld",
                                            [["js-big-bang",  1, false]
                                             ,["big-bang",    1, false]
                                             ,["js-div",      0, false]
                                             ,["js-p",        0, false]
                                             ,["js-button",   2, false]
                                             ,["js-button!",  2, false]
                                             ,["js-node",     1, false]
                                             ,["js-text",    1, false]
                                             ,["js-select",   2, false]
                                             ,["js-img",      1, false, ["android.permission.INTERNET"]]
                                             ].map(makeFunctionBinding('"moby/jsworld"'))
  );
  
  // world
  var worldModule       = new moduleBinding("world",
                                           worldHandlersModule.bindings.concat(worldEffectsModule.bindings,
                                           ["key=?"
                                            ,"play-sound"
                                            ,"animate"
                                            ,"big-bang"
                                            // colors
                                            ,"make-color"
                                            ,"color?"
                                            ,"color-red"
                                            ,"color-green"
                                            ,"color-blue"
                                            ,"color-alpha"
                                            
                                            ,"empty-scene"
                                            ,"empty-image"
                                            ,"scene+line"
                                            ,"put-image"
                                            ,"place-image"
                                            ,"place-image/align"
                                            //,"put-pinhole"
                                            ,"circle"
                                            ,"star"
                                            ,"polygon"
                                            ,"radial-star"
                                            ,"star-polygon"
                                            ,"nw:rectangle"
                                            ,"rectangle"
                                            ,"regular-polygon"
                                            ,"rhombus"
                                            ,"square"
                                            ,"triangle"
                                            ,"triangle/sas"
                                            ,"triangle/sss"
                                            ,"triangle/ass"
                                            ,"triangle/ssa"
                                            ,"triangle/aas"
                                            ,"triangle/asa"
                                            ,"triangle/saa"
                                            ,"right-triangle"
                                            ,"isosceles-triangle"
                                            ,"ellipse"
                                            ,"line"
                                            ,"add-line"
                                            ,"add-polygon"
                                            ,"overlay"
                                            ,"overlay/xy"
                                            ,"overlay/align"
                                            ,"underlay"
                                            ,"underlay/xy"
                                            ,"underlay/align"
                                            ,"beside"
                                            ,"beside/align"
                                            ,"above"
                                            ,"above/align"
                                            ,"rotate"
                                            ,"scale"
                                            ,"scale/xy"
                                            ,"crop"
                                            ,"frame"
                                            ,"flip-horizontal"
                                            ,"flip-vertical"
                                            ,"reflect-x"
                                            ,"reflect-y"
                                            ,"text"
                                            ,"text/font"
                                            ,"video/url"       // needs network
                                            ,"bitmap/url"      // needs network
                                            ,"image-url"       // needs network
                                            ,"image?"
                                            ,"image=?"
                                            ,"image-width"
                                            ,"image-height"
                                            
                                            // mouse-events
                                            ,"mouse-event?"
                                            ,"mouse=?"
                                            
                                            ,"image->color-list"
                                            ,"color-list->image"
                                            ,"color-list->bitmap"
                                            
                                            ,"image-baseline"
                                            ,"mode?"
                                            ,"image-color?"
                                            ,"name->color"
                                            ,"x-place?"
                                            ,"y-place?"
                                            ,"angle?"
                                            ,"side-count?"
                                            ,"step-count?"
                                            ].map(function(binding){
                                                    var needsPermission = ["video/url", "bitmap/url", "image-url"];
                                                    var permissions = (needsPermission.indexOf(binding) > -1)? ["android.permission.INTERNET"] : [];
                                                    return new constantBinding(binding, '"moby/world"', permissions, false);
                                                  }))
  );

  // top-level
  var topLevelModule = new moduleBinding("moby/topLevel",
                                         [["<", 2, true] // Numerics
                                         ,["<=", 2, true]
                                         ,["=", 2, true]
                                         ,[">", 2, true]
                                         ,[">=", 2, true]
                                         ,["<>", 2, true]

                                         ,["=~", 3]
                                         ,["number->string", 1]
                                         ,["even?", 1]
                                         ,["odd?", 1]
                                         ,["positive?", 1]
                                         ,["negative?", 1]
                                         ,["number?", 1]
                                         ,["rational?", 1]
                                         ,["quotient", 2]
                                         ,["remainder", 2]
                                         ,["numerator", 1]
                                         ,["denominator", 1]
                                         ,["integer?", 1]
                                         ,["real?", 1]
                                         ,["abs", 1]
                                         ,["acos", 1]
                                         ,["add1", 1]
                                         ,["angle", 1]
                                         ,["asin", 1]
                                         ,["atan", 1, true]           // arity is either 1 or 2
                                         ,["ceiling", 1]
                                         ,["complex?", 1]
                                         ,["conjugate", 1]
                                         ,["cos", 1]
                                         ,["cosh", 1]
                                         ,["denominator", 1]
                                         ,["even?", 1]
                                         ,["exact->inexact", 1]
                                         ,["exact?", 1]               // *
                                         ,["exp", 1]
                                         ,["expt", 2]
                                         ,["floor", 1]
                                         ,["gcd", 1, true]
                                         ,["imag-part", 1]
                                         ,["inexact->exact", 1]
                                         ,["inexact?", 1]
                                         ,["integer->char", 1]
                                         ,["integer-sqrt", 1]         // *
                                         ,["integer?", 1]
                                         ,["lcm", 1, true]
                                         ,["log", 1]
                                         ,["magnitude", 1]
                                         ,["make-polar", 2]           // *
                                         ,["make-rectangular", 2]     // *
                                         ,["max", 1, true]
                                         ,["min", 1, true]
                                         ,["modulo", 2]
                                         ,["negative?", 1]
                                         ,["number?", 1]
                                         ,["numerator", 1]
                                         ,["odd?", 1]
                                         ,["positive?", 1]
                                         ,["random", 1]
                                         ,["rational?", 1]
                                         ,["real-part", 1]
                                         ,["real?", 1]
                                         ,["round", 1]
                                         ,["sgn", 1]
                                         ,["sin", 1]
                                         ,["sinh", 1]
                                         //,["sq", 1]
                                         ,["sqr", 1]
                                         ,["sqrt", 1]
                                         ,["nth-root", 2]
                                         ,["sub1", 1]
                                         ,["tan", 1]
                                         ,["zero?", 1]
                                         
                                         ,["+", 0, true]
                                         ,["-", 1, true]
                                         ,["*", 0, true]
                                         ,["/", 1, true]
                                         
                                         // Logic
                                         ,["not", 1]
                                         ,["false?", 1]
                                         ,["boolean?", 1]
                                         ,["boolean=?", 2]
                                         
                                         // Symbols
                                         ,["symbol->string", 1]
                                         ,["symbol=?", 2]
                                         ,["symbol?", 1]
                                         
                                         // Lists
                                         ,["append", 0, true]
                                         ,["assq", 2]                 // *
                                         ,["assv", 2]                 // *
                                         ,["assoc", 2]                // *
                                         ,["caaar", 1]
                                         ,["caadr", 1]
                                         ,["caar", 1]
                                         ,["cadar", 1]
                                         ,["cadddr", 1]
                                         ,["caddr", 1]
                                         ,["cadr", 1]
                                         ,["car", 1]
                                         ,["cddar", 1]
                                         ,["cdddr", 1]
                                         ,["cddr", 1]
                                         ,["cdr", 1]
                                         ,["cdaar", 1]
                                         ,["cdadr", 1]
                                         ,["cdar", 1]
                                         ,["cons?", 1]
                                         ,["list?", 1]
                                         ,["cons", 2]
                                         ,["empty?", 1]
                                         ,["length", 1]
                                         ,["list", 0, true]
                                         ,["list*", 1, true]
                                         ,["range", 3]
                                         ,["list-ref", 2]
                                         ,["remove", 2]
                                         ,["remove-all", 2]
                                         ,["member", 2]
                                         ,["member?", 2]
                                         ,["memq", 2]
                                         ,["memv", 2]
                                         ,["null?", 1]
                                         ,["pair?", 1]
                                         ,["rest", 1]
                                         ,["reverse", 1]
                                         ,["first", 1]
                                         ,["second", 1]
                                         ,["third", 1]
                                         ,["fourth", 1]
                                         ,["fifth", 1]
                                         ,["sixth", 1]
                                         ,["seventh", 1]
                                         ,["eighth", 1]
                                         ,["make-list", 2]
                                         
                                         // We're commenting out the mutation operation on pairs
                                         // because they're not supported in ISL/ASL anymore.
                                         //;,["set-car! 2]
                                         //;,["set-cdr! 2]
                                         
                                         // Box
                                         ,["box", 1]
                                         ,["unbox", 1]
                                         ,["set-box!", 2]
                                         ,["box?", 1]
                                         
                                         // Posn
                                         ,["make-posn", 2]
                                         ,["posn-x", 1]
                                         ,["posn-y", 1]
                                         ,["posn?", 1]
                                         
                                         // Characters
                                         ,["char->integer", 1]
                                         ,["char-alphabetic?", 1]
                                         ,["char-ci<=?", 2, true]
                                         ,["char-ci<?", 2, true]
                                         ,["char-ci=?", 2, true]
                                         ,["char-ci>=?", 2, true]
                                         ,["char-ci>?", 2, true]
                                         ,["char-downcase", 1]
                                         ,["char-lower-case?", 1]
                                         ,["char-numeric?", 1]
                                         ,["char-upcase", 1]
                                         ,["char-upper-case?", 1]
                                         ,["char-whitespace?", 1]
                                         ,["char<=?", 2, true]
                                         ,["char<?", 2, true]
                                         ,["char=?", 2, true]
                                         ,["char>=?", 2, true]
                                         ,["char>?", 2, true]
                                         ,["char?", 1]
                                         
                                         // Strings
                                         ,["format", 1, true]
                                         ,["list->string", 1]
                                         ,["make-string", 2]
                                         ,["replicate", 2]
                                         ,["string", 0, true]
                                         ,["string->list", 1]
                                         ,["string->number", 1]
                                         ,["string->symbol", 1]
                                         ,["string-alphabetic?", 1]
                                         ,["string-append", 0, true]
                                         ,["string-contains?", 2 ]
                                         ,["string-ci<=?", 2, true]
                                         ,["string-ci<?", 2, true]
                                         ,["string-ci=?", 2, true]
                                         ,["string-ci<>?", 2, true]
                                         ,["string-ci>=?", 2, true]
                                         ,["string-ci>?", 2, true]
                                         ,["string-copy", 1]
                                         ,["string-length", 1]
                                         ,["string-lower-case?", 1]   // *
                                         ,["string-numeric?", 1]      // *
                                         ,["string-ref", 2]
                                         ,["string-upper-case?", 1]   // *
                                         ,["string-whitespace?", 1]   // *
                                         ,["string<=?", 2, true]
                                         ,["string<?", 2, true]
                                         ,["string=?", 2, true]
                                         ,["string<>?", 2, true]
                                         ,["string>=?", 2, true]
                                         ,["string>?", 2, true]
                                         ,["string?", 1]
                                         ,["substring", 3 ]
                                         ,["string-ith", 2]
                                         ,["int->string", 1]
                                         ,["string->int", 1]
                                         ,["explode", 1]
                                         ,["implode", 1]
                                         
                                         // Eof
                                         ,["eof-object?", 1]
                                         
                                         // Misc
                                         ,["=~", 3]
                                         ,["eq?", 2]
                                         ,["equal?", 2]
                                         ,["equal~?", 3]
                                         ,["eqv?", 2]
                                         ,["error", 2]
                                         
                                         ,["identity", 1]
                                         ,["struct?", 1]
                                         ,["current-seconds", 0]
                                         
                                         // Higher-Order Functions
                                         ,["andmap", 1, true]
                                         ,["apply", 2, true]          // *
                                         ,["argmax", 2]               // *
                                         ,["argmin", 2]               // *
                                         ,["build-list", 2]
                                         ,["build-string", 2]         // *
                                         ,["compose", 0, true]        // *
                                         ,["filter", 2]               // *
                                         ,["foldl", 2, true]
                                         ,["foldr", 2, true]          // *
                                         ,["map", 1, true]
                                         ,["for-each", 1, true]
                                         ,["memf", 2]                 // *
                                         ,["ormap", 1, true]          // *
                                         ,["procedure?", 1]           // *
                                         ,["quicksort", 2]            // *
                                         ,["sort", 2]                 // *
                                         
                                         ,["void", 0, true]
                                           
                                         // Parsing
                                         ,["xml->s-exp", 1]
                                         
                                         // Vectors
                                         ,["build-vector", 2]
                                         // FIXME: should only take one or two arguments", not vararity
                                         ,["make-vector", 1, true]
                                         ,["vector", 0, true]
                                         ,["vector-length", 1]
                                         ,["vector-ref", 2]
                                         ,["vector-set!", 3]
                                         ,["vector->list", 1]
                                         ,["list->vector", 1]
                                         ,["vector?", 1]
                                         
                                         ,["printf", 1, true]
                                         ,["display", 1]
                                         ,["write", 1]
                                         ,["newline", 0]
                                         ,["call/cc", 1]
                                         ,["procedure-arity", 1]
                                         
                                         
                                         // Testing functions.
                                         // NOTE: the desugar.ss module converts use of check-expect into ones that
                                         // thunk its arguments", and pass an additional location argument.
                                         ,["check-expect", 2]
                                         ,["EXAMPLE", 2]
                                         ,["check-within", 3]
                                         ,["check-error", 2]
                                         ,["make-hasheq", 0]
                                         ,["make-hash", 0]
                                         ,["hash-set!", 3 ]
                                         ,["hash-ref", 3]
                                         ,["hash-remove!", 2]
                                         ,["hash-map", 2]
                                         ,["hash-for-each", 2]
                                         ,["hash?", 1]
                                         
                                         // Exception raising
                                         ,["raise", 1]
                                         
                                         // Checking for undefined
                                         ,["undefined?", 1]
                                         
                                         // values for multiple value definition
                                         ,["values", 0, true]
                                         
                                         // structures
                                         ,["make-struct-type", 4, true]
                                         ,["make-struct-field-accessor", 2, true]
                                         ,["make-struct-field-mutator", 2, true]
                                         
                                         // continuation mark stuff
                                         // FIXME: add support for prompt optional argument
                                         ,["current-continuation-marks", 0, false]
                                         ,["continuation-mark-set->list", 2, false]
                                         
                                         // Things for javascript FFI and world
                                         ,["scheme->prim-js", 1, false]
                                         ,["prim-js->scheme", 1, false]
                                         ,["procedure->cps-js-fun", 1, false]
                                         ,["procedure->void-js-fun", 1, false]
                                         ,["js-===", 2, false]
                                         ,["js-get-named-object", 1, false]
                                         ,["js-get-field", 2, true]
                                         //,["get-js-array-field", 2, false]
                                         ,["js-set-field!", 3, false]
                                         //,["js-set-array-field!", 3, false]
                                         ,["js-typeof", 1, false]
                                         ,["js-instanceof", 2, false]
                                         ,["js-call", 2, true]
                                         ,["js-new", 1, true]
                                         ,["js-make-hash", 0, true]
                                         
                                         ,["make-world-config", 2, true]
                                         ,["make-bb-info", 2, false]
                                         ,["bb-info?", 1, false]
                                         ,["bb-info-change-world", 1, false]
                                         ,["bb-info-toplevel-node", 1, false]
                                         
                                         ,["make-effect-type", 4, true]
                                         ,["effect?", 1, false]
                                         ,["world-with-effects", 2, false]
                                         //,["coerce-world-handler", 1, false]
                                         ,["make-render-effect-type", 4, true]
                                         ,["render-effect-type?", 1]
                                         ,["render-effect?", 1]
                                         
                                         //,["make-effect:do-nothing 0, false]
                                         //,["effect:do-nothing? 1, false]
                                         
                                         ,["make-render-effect-type", 4, true]
                                         //,["render-effect-name 1, false]
                                         //,["render-effect-dom-node 1, false]
                                         //,["render-effect-effects 1, false]
                                         //,["render-effect? 1, false]
                                         
                                         ,["values", 0, true]
                                         ,["sleep", 0, true]
                                         ,["current-inexact-milliseconds", 0, false]
                                         
                                         ,["make-exn", 2, false]
                                         ,["exn-message", 1, false]
                                         ,["exn-continuation-marks", 1, false]
                                        ].map(makeFunctionBinding('"moby/toplevel"'))
  );

  // The core environment includes the baseConstants, the topLevel bindings, and the world bindings
  // NOTE: worldModule *includes* worldEffects and worldHandlers, according to Danny's modules.ss file
 plt.compiler.topLevelModules = [topLevelModule, kernelMiscModule, , jsWorldModule, worldModule];
 plt.compiler.knownCollections = ["bootstrap", "bootstrap2011", "bootstrap2012", "bootstrap2014", "bootstrap2015", "bootstrap2020"];
 
 
 plt.compiler.knownModules = [kernelMiscModule
                              , jsWorldModule
                              , foreignModule
                              , worldModule
                              , bootstrapTeachpack
                              , bootstrapTeachpack2011
                              , bootstrapTeachpack2012
                              , bootstrapTeachpack2014
                              , bootstrapTeachpack2015
                              , bootstrapTiltTeachpack2012
                              , bootstrapTiltTeachpack2014
                              , bootstrapTiltTeachpack2015
                              , cageTeachpack
                              , cageTeachpack2011
                              , cageTeachpack2012
                              , cageTeachpack2014
                              , cageTeachpack2015
                              , booleanTeachpack2020
                              , functionTeachpack
                              , functionTeachpack2011
                              , functionTeachpack2012
                              , functionTeachpack2014
                              , functionTeachpack2015
                              , locationModule
                              , tiltModule
                              , telephonyModule
                              , netModule
                              , parserModule
                              , topLevelModule];
})();
