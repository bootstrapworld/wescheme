
// Depends on world.js, world-config.js

(function() {

    var Jsworld = jsworld.MobyJsworld = {};

    // The real low-level jsworld module:
    var _js = jsworld.Jsworld;






//////////////////////////////////////////////////////////////////////
// From:
// https://gist.github.com/1579671

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel
 
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
//////////////////////////////////////////////////////////////////////
var bigBangLog = document.getElementById('bigBangLog');

var caller;
var setCaller = function(c) {
	caller = function(op, args, k) {
		c(op, args, k, handleError);
	};
};
var unsetCaller = function() {
	caller = function() {
		throw new Error('caller not defined!');
	};
};
unsetCaller();

// The restarted and things to set it
// Note that we never want to restart the same computation
// more than once, so we throw an error if someone tries to do that
var restarter;
var setRestarter = function(r) {
    var hasRestarted = false;
    restarter = function(v) {
	    if (hasRestarted) {
		    throw new Error('Cannot restart twice!');
	    }
	    hasRestarted = true;
	    r(v);
    };
};
var unsetRestarter = function() {
	restarter = function() {
		throw new Error('restarter not defined!');
	};
};
unsetRestarter();

var terminator;
var setTerminator = function(t) {
    terminator = t;
};
var unsetTerminator = function() {
	terminator = function() {
		throw new Error('terminator not defined!');
	};
};
unsetTerminator();



var userConfigs = [];

var startUserConfigs = function(k) {
    helpers.forEachK(userConfigs,
		     function(aConfig, k2) {
			caller(aConfig.startup, aConfig.startupArgs,
				function(res) {
					aConfig.shutdownArg = res;
					k2()
				});
		     },
		     handleError,
		     k);
}

var shutdownUserConfigs = function(k) {
    var theConfigs = userConfigs;
    userConfigs = []
    helpers.forEachK(theConfigs,
		     function(aConfig, k2) {
		     	caller(aConfig.shutdown, [aConfig.shutdownArg], k2);
		     },
		     handleError,
		     k);
}

var expandHandler = function(handler) {
	return types.jsObject('function', function() {
		var wrappedStimulusArgs = [];
		for (var i = 0; i < arguments.length; i++) {
			wrappedStimulusArgs.push( helpers.wrapJsObject(arguments[i]) );
		}

		Jsworld.updateWorld(
			function(w, k) {
				var args = [w].concat(wrappedStimulusArgs);
				caller(handler, args, k);
			},
			function() {});
	});
};

var deepUnwrapJsObjects = function(x, k) {
    if ( types.isJsObject(x) ) {
	    k(x.obj);
    }
    else if ( types.isRenderEffect(x) ) {
	    x.callImplementation(caller, function(y) { deepUnwrapJsObjects(y, k); });
    }
	/*
	    var effects = helpers.schemeListToArray( types.renderEffectEffects(x) ).reverse();
	    types.setRenderEffectEffects(x, types.EMPTY);

	    helpers.forEachK(effects,
			     function(ef, k2) { caller(ef, [], k2); },
			     handleError,
			     function() { deepUnwrapJsObjects(types.renderEffectDomNode(x), k); });
	}
	*/
    else if ( types.isPair(x) ) {
	deepUnwrapJsObjects(x.first(), function(first) {
			deepUnwrapJsObjects(x.rest(), function(rest) {
				k( types.cons(first, rest) );
			});
		});
    }
    else {
	    k(x);
    }
};


// isHandler: X -> boolean
// Right now, a handler is a function that consumes and produces
// configs.  We should tighten up the type check eventually.
var isHandler = function(x) {
	return typeof(x) == 'function';
}


//////////////////////////////////////////////////////////////////////
//From this point forward, we define wrappers to integrate jsworld
//with Moby.


// getBigBangWindow: -> window
var getBigBangWindow = function() {
    if (window.document.getElementById("jsworld-div") !== undefined) {
    	return window;
	} else {
	    var newDiv = window.document.createElement("div");
	    newDiv.id = 'jsworld-div';
	    window.document.appendChild(newDiv);
	    return window;
	}
}


// types are
// sexp: (cons node (listof sexp))
// css-style: (node (listof (list string string)))

// Exports:
var isPair = types.isPair;
var isEmpty = function(x) { return x === types.EMPTY; };
var isList = function(x) { return (isPair(x) || isEmpty(x)); };



// The default printWorldHook will write the written content of the node.
// We probably want to invoke the pretty printer here instead!
Jsworld.printWorldHook = function(world, node) {
	var newNode;
	if(node.lastChild == null) {
	    newNode = types.toDomNode(world);
	    node.appendChild(newNode);
	    helpers.maybeCallAfterAttach(newNode);
	} else {
	    newNode = types.toDomNode(world);
	    node.replaceChild(newNode, node.lastChild);
	    helpers.maybeCallAfterAttach(newNode);
	}
};



// Figure out the target of an event.
// http://www.quirksmode.org/js/events_properties.html#target
var findEventTarget = function(e) {
	var targ;
	if (e.target) 
	    targ = e.target;
	else if (e.srcElement) 
	    targ = e.srcElement;
	if (targ.nodeType == 3) // defeat Safari bug
	    targ = targ.parentNode;
	return targ;
}

// isNode: any -> boolean
// Returns true if the thing has a nodeType.
var isNode = function(thing) {
	return typeof(thing.nodeType) != 'undefined';
}



// checkWellFormedDomTree: X X (or number undefined) -> void
// Check to see if the tree is well formed.  If it isn't,
// we need to raise a meaningful error so the user can repair
// the structure.
//
// Invariants:
// The dom tree must be a pair.
// The first element must be a node.
// Each of the rest of the elements must be dom trees.
// If the first element is a text node, it must NOT have children.
var checkWellFormedDomTree = function(x, top, index) {
	var fail = function(formatStr, formatArgs) {
		throw types.schemeError(
			types.incompleteExn(types.exnFailContract,
					    helpers.format(formatStr, formatArgs),
			       		    []));
	}

	if (_js.isPage(x)) {
	    return;
	}

	if (types.isPair(x)) {
	    var firstElt = x.first();
	    var restElts = x.rest();

	    if (! isNode(firstElt)) {
		fail("on-draw: expected a dom-element, but received ~s instead, the first element within ~s", [firstElt, top]);
	    }

	    if (firstElt.nodeType == Node.TEXT_NODE && !restElts.isEmpty() ) {
		fail("on-draw: the text node ~s must not have children.  It has ~s", [firstElt, restElts]);
	    }

	    var i = 2;
	    while( !restElts.isEmpty() ) {
		checkWellFormedDomTree(restElts.first(), x, i);
		restElts = restElts.rest();
		i++;
	    }
	} else {
		var formatStr = "on-draw: expected a dom-s-expression, but received ~s instead";
		var formatArgs = [x];
		if (index != undefined) {
			formatStr += ", the ~a element within ~s";
			formatArgs.push( helpers.ordinalize(index) );
			formatArgs.push(top);
		}
		formatStr += ".";

		fail(formatStr, formatArgs);
	}
};

// Compatibility for attaching events to nodes.
var attachEvent = function(node, eventName, fn) {
	if (node.addEventListener) {
	    // Mozilla
	    node.addEventListener(eventName, fn, false);
	} else {
	    // IE
	    node.attachEvent('on' + eventName, fn, false);
	}
	return function() {
	    detachEvent(node, eventName, fn);
	}
};

var detachEvent = function(node, eventName, fn) {
	if (node.addEventListener) {
	    // Mozilla
	    node.removeEventListener(eventName, fn, false);
	} else {
	    // IE
	    node.detachEvent('on' + eventName, fn, false);
	}
}


var preventDefault = function(event) {
	if (event.preventDefault) {
	    event.preventDefault();
	} else {
	    event.returnValue = false;
	}
}

var stopPropagation = function(event) {
	if (event.stopPropagation) {
	    event.stopPropagation();
	} else {
	    event.cancelBubble = true;
	}
}


// bigBang: world dom (listof (list string string)) (arrayof handler) -> world
Jsworld.bigBang = function(initWorld, toplevelNode, handlers, theCaller, theRestarter) {

	// shutdownListeners: arrayof (-> void)
	// We maintain a list of thunks that need to be called as soon as we come out of
	// bigBang, to do cleanup.
	var shutdownListeners = [];

	var onTermination = function(w) {
	    for (var i = 0; i < shutdownListeners.length; i++) {
		try { 
		    shutdownListeners[i]();
		} catch (e) { }
	    }
	    shutdownUserConfigs(function() {
		unsetCaller();
		theRestarter(w);
	    });
	}

	setCaller(theCaller);
	setRestarter(theRestarter);
	setTerminator(function(w) {
		detachEvent(toplevelNode, 'click', absorber);
		shutdownUserConfigs(function() {
			unsetCaller();
			unsetTerminator();
			restarter(w);
		});
	});

	var attribs = types.EMPTY;
	
	// Ensure that the toplevelNode can be focused by mouse or keyboard
	toplevelNode.tabIndex = 0;

	// Absorb all click events so they don't bubble up.
	var absorber = function(e) {
		preventDefault(e);
		stopPropagation(e);
		return false;
	}

	attachEvent(toplevelNode, 'click', absorber);
	shutdownListeners.push(function() { detachEvent(toplevelNode, 'click', absorber)});

	var config = new world.config.WorldConfig();
	for(var i = 0; i < handlers.length; i++) {
	    if (isList(handlers[i])) {
		attribs = handlers[i];
	    }
	    else if (isHandler(handlers[i])) {
		config = handlers[i](config);
	    }
	    else if ( types.isWorldConfig(handlers[i]) ) {
		    handlers[i].startupArgs = helpers.map(expandHandler, handlers[i].startupArgs);
		    userConfigs.push(handlers[i]); 
	    }
	}
	config = config.updateAll({'changeWorld': Jsworld.updateWorld,
                            'shutdownWorld': Jsworld.shutdownWorld});
	var stimuli = new world.stimuli.StimuliHandler(config, caller, restarter);
	
	var wrappedHandlers = [];
	var wrappedRedraw;
	var wrappedRedrawCss;
  	var last3frames = []; // for FPS calculation

  	// on-draw may define separate DOM and CSS handlers
	if (config.lookup('onDraw')) {
	    wrappedRedraw = function(w, k) {
        try {
            caller(config.lookup('onDraw'), [w],
              function(newDomTree) {
                deepUnwrapJsObjects(newDomTree, function(unwrappedTree) {
              checkWellFormedDomTree(unwrappedTree, unwrappedTree, undefined);
              var result = [toplevelNode, 
                      helpers.deepListToArray(unwrappedTree)];
              k(result);
            });
              });
        } catch (e) {
            handleError(e);
        }
	    }

	    if (config.lookup('onDrawCss')) {
		    wrappedRedrawCss = function(w, k) {
          try {
              caller(config.lookup('onDrawCss'), [w],
                function(res) {
              var result = helpers.deepListToArray(res);
              k(result);
                });
          } catch (e) {
              handleError(e);
          }
		    }
	    } else {
		    wrappedRedrawCss = function(w, k) { k([]); };
	    }
	    wrappedHandlers.push(_js.on_draw(wrappedRedraw, wrappedRedrawCss));
	}
 
  	// on-redraw defines an image-producing handler, and a dummy CSS handler
  	else if (config.lookup('onRedraw')) {
	    var reusableCanvas = undefined;
	    var reusableCanvasNode = undefined;
	    wrappedRedraw = function(w, k) {
        var nextFrame = function(t) {
          last3frames = [t/1000].concat(last3frames); // save the # ms
          last3frames = last3frames.slice(0,3); // only keep the last 3 saves
          // report running FPS avg
          //if(last3frames.length===3) console.log(Math.round(3 / (last3frames[0] - last3frames[2]))+"fps");
          try {
            // By the time we get here, the current world may have changed
            // already, so we need to reacquire the value of the
            // current world.
            w = _js.getCurrentWorld();
		        caller(config.lookup('onRedraw'), [w],
			       function(aScene) {
		               // Performance hack: if we're using onRedraw, we know
		               // we've got a scene, so we optimize away the repeated
		               // construction of a canvas object.
		               if ( world.Kernel.isImage(aScene) ) {
		                   var width = aScene.getWidth();
		                   var height = aScene.getHeight();

		                   if (! reusableCanvas) {
		                 reusableCanvas = world.Kernel.makeCanvas(width, height);
		                 // Note: the canvas object may itself manage objects,
		                 // as in the case of an excanvas.  In that case, we must make
		                 // sure jsworld doesn't try to disrupt its contents!
		                 reusableCanvas.jsworldOpaque = true;
		                 reusableCanvasNode = _js.node_to_tree(reusableCanvas);
		                   }

		                   setTimeout(
		                 function() {			
		                 	reusableCanvas.width = width;
		                 	reusableCanvas.height = height;
		                     var ctx = reusableCanvas.getContext("2d");
		                     aScene.render(ctx, 0, 0);
		                     var log = document.createElement("span");
		                     log.className = "screenreader-only";
		                     log.appendChild(document.createTextNode(aScene.getAriaText(6)));
		                     toplevelNode.appendChild(log);
		                 },
		                 0);

		                   k([toplevelNode, reusableCanvasNode]);
		               } else {
		               	  handleError("to-draw handler: is expected to return a scene or image");
		                  // k([toplevelNode, _js.node_to_tree(types.toDomNode(aScene))]);
		               }
			       });
          } catch (e) {
		        handleError(e);
          }
        };
        window.requestAnimationFrame(nextFrame);
	    }
	    wrappedRedrawCss = function(w, k) {
        k([[reusableCanvas,
            ["width", reusableCanvas.width + "px"],
            ["height", reusableCanvas.height + "px"]]]);
      };
	    wrappedHandlers.push(_js.on_draw(wrappedRedraw, wrappedRedrawCss));
	}
 
  	// if no draw handlers are defined, we just print the state of the world
  	else {
	    wrappedHandlers.push(_js.on_world_change
				 (function(w, k) { 
				     Jsworld.printWorldHook(w, toplevelNode);
				     k();
				 }));
	}

	if (config.lookup('tickDelay')) {
	    var wrappedTick = function(w, k) {
		caller(config.lookup('onTick'), [w], k);
	    }
	    var wrappedDelay = jsnums.toFixnum( config.lookup('tickDelay') );
	    wrappedHandlers.push(_js.on_tick(wrappedDelay, wrappedTick));
	}

	if (config.lookup('stopWhen')) {
      var worldFunction = function(w, k) {
                            caller(config.lookup('stopWhen'), [w],
                                   function(res) { k(res); });
      };
      var lastPictureFunction = function(w, k) {
        var nextFrame = function(t) {
          try {
            if(config.lookup('lastPicture')){
              // By the time we get here, the current world may have changed
              // already, so we need to reacquire the value of the
              // current world.
              w = _js.getCurrentWorld();
              caller(config.lookup('lastPicture'), [w],
               function(aScene) {
                 if ( world.Kernel.isImage(aScene) ) {
                     setTimeout(
                       function() {
                           reusableCanvas.width = aScene.getWidth();
                           reusableCanvas.height = aScene.getHeight();
                           var ctx = reusableCanvas.getContext("2d");
                           aScene.render(ctx, 0, 0);
                       },
                       0);
                 } else {
                     handleError("stop-when handler: is expected to return a scene or image");
                 }
               });
            }
          } catch (e) {
            handleError(e);
          }
        };
        lastPictureCss = function(w, k) {
          k([[reusableCanvas,
          	["width", reusableCanvas.width + "px"],
          	["height", reusableCanvas.height + "px"]]]);
        };
        return _js.on_draw(nextFrame, lastPictureCss)();
      };

      wrappedHandlers.push(_js.stop_when(worldFunction, undefined, lastPictureFunction));
	}
	
	if (config.lookup('onKey')) {
	    // // TODO: add virtual key bindings
	    // var removeVirtualKeys = addVirtualKeys(stimuli, toplevelNode);
	    // shutdownListeners.push(function() { removeVirtualKeys(); });
	    var wrappedKey = function(w, e, k) {
        // get control character names on keydown, otherwise use ASCII equivalent for key
        // remove all non-printable chars on keypress
        var keyChar = e.type==="keydown"? helpers.getKeyCodeName(e)
                : String.fromCharCode(e.which).replace(/[^\x00-\xFE]+/g, '');
          caller(config.lookup('onKey'), [w, keyChar], k);
	    }
	    wrappedHandlers.push(_js.on_key(wrappedKey));
	    toplevelNode.focus();
	}

  	var mouseIsDown = false;
  	if (config.lookup('onMouse')) {
	  	if(!(config.lookup('onRedraw') || config.lookup('onDraw'))) {
	  		handleError("a mouse handler cannot be used without a draw handler");
	  	}
  		
	    var wrappedMouse = function(w, e, k) {
          // browsers don't send drag events for *all* move-while-down mouse events,
          // so we use state to track those events
          if(e.type==="mousedown") mouseIsDown = true;
          if(e.type==="mouseup" || e.type==="mouseleave")   mouseIsDown = false;
 
          var x = e.pageX, y = e.pageY,
              type  = e.type==='mousedown' ? "button-down"
                    : e.type==='mouseup'   ? "button-up"
                    : e.type==='mouseenter'? "enter"
                    : e.type==='mouseleave'? "leave"
                    : (e.type==='mousemove' && mouseIsDown)? "drag"
                    : e.type==='mousemove'? "move"
                    : e.type;
 
          var currentElement = e.target;
          do {
              x -= currentElement.offsetLeft;
              y -= currentElement.offsetTop;
              currentElement = currentElement.offsetParent;
          } while(currentElement);

          var scaledX = x*e.target.width/e.target.offsetWidth
              scaledY = y*e.target.height/e.target.offsetHeight;
          caller(config.lookup('onMouse'), [w, scaledX, scaledY, type], k);
	    }
	    wrappedHandlers.push(_js.on_mouse(wrappedMouse));
  	}
 
	if (config.lookup('onTap')) {
		var wrappedTap = function(w, e, k) {
	        var x = e.pageX, y = e.pageY;
	        var currentElement = e.target;
	        do {
	            x -= currentElement.offsetLeft;
	            y -= currentElement.offsetTop;
	            currentElement = currentElement.offsetParent;
	        } while(currentElement);

			caller(config.lookup('onTap'), [w, x, y], k);
		}
		wrappedHandlers.push(_js.on_tap(wrappedTap));
	}

	if (config.lookup('onTilt')) {
	    var wrappedTilt = function(w, gamma, beta, k) {
			caller(config.lookup('onTilt'), [w, jsnums.makeFloat(gamma), jsnums.makeFloat(beta)], k);
	    }
	    wrappedHandlers.push(_js.on_tilt(wrappedTilt));
	    toplevelNode.focus();
	}

	startUserConfigs(function() {
		_js.big_bang(toplevelNode,
			     initWorld,
			     wrappedHandlers,
			     helpers.assocListToHash(attribs),
			     terminator);
	});

	return {
	    breaker: function() {
		handleError(types.schemeError(
		    types.incompleteExn(types.exnBreak, 'user break', [])));
	    }
	};

    }



    var addVirtualKeys = function(stimuli, toplevelNode) {
	var makeVirtualButton = function(className, label, keyCode) {
	    var button = document.createElement("input");
	    button.type = "button";
	    button.value = label;
	    button.style.width = "20px";
	    button.style.height = "20px";
	    button.onclick = function(e) {
		stimuli.onKey([{keyCode: keyCode}], function() {});
		preventDefault(e);
		stopPropagation(e);
	    };
	    return button;
	};

	var upButton = makeVirtualButton('up-virtual-button', "U", 38);
	var downButton = makeVirtualButton('down-virtual-button', "D", 40);
	var leftButton = makeVirtualButton('left-virtual-button', "L", 37);
	var rightButton = makeVirtualButton('right-virtual-button', "R", 39);
	var fireButton = makeVirtualButton('space-virtual-button', " ", 32);

	upButton.style['position'] = 'fixed';
	upButton.style['bottom'] = '60px';
	upButton.style['right'] = '50px';

	downButton.style['position'] = 'fixed';
	downButton.style['bottom'] = '0px';
	downButton.style['right'] = '50px';

	leftButton.style['position'] = 'fixed';
	leftButton.style['bottom'] = '30px';
	leftButton.style['right'] = '80px';

	rightButton.style['position'] = 'fixed';
	rightButton.style['bottom'] = '30px';
	rightButton.style['right'] = '20px';

	fireButton.style['position'] = 'fixed';
	fireButton.style['bottom'] = '30px';
	fireButton.style['right'] = '50px';


	toplevelNode.appendChild(upButton);
	toplevelNode.appendChild(downButton);
	toplevelNode.appendChild(leftButton);
	toplevelNode.appendChild(rightButton);
	toplevelNode.appendChild(fireButton);

	return function() {
	    toplevelNode.removeChild(upButton);
	    toplevelNode.removeChild(downButton);
	    toplevelNode.removeChild(leftButton);
	    toplevelNode.removeChild(rightButton);
	    toplevelNode.removeChild(fireButton);
	};
    };


    var handleError = function(e) {
    	console.log('handling error', e);
    	/*
		helpers.reportError(e);
		// When something bad happens, shut down 
		// the world computation.
		helpers.reportError("Shutting down jsworld computations");
		world.stimuli.onShutdown(); 
		*/
		world.stimuli.massShutdown();
		shutdownUserConfigs(function() {
			/*
			// console.log('Got an error, the error was:');
			// console.log(e);
			 if (typeof(console) !== 'undefined' && console.log) {
			 	if (e.stack) {
			 		console.log(e.stack);
			 	}
			 	else {
			 		console.log(e);
			 	}
			 }
			*/
			if ( types.isSchemeError(e) ) {
				console.log(1);
				terminator(e);
			}
			else if ( types.isInternalError(e) ) {
				console.log(2);
				terminator(e);
			}
			else if (typeof(e) == 'string') {
				console.log(3);
				terminator( types.schemeError(types.incompleteExn(types.exnFail, e, [])) );
			}
			else if (e instanceof Error) {
				console.log(4);
				terminator( types.schemeError(types.incompleteExn(types.exnFail, e.message, [])) );
			}
			else {
				console.log(5);
				terminator( types.schemeError(e) );
			}
		});
    }
    


    // updateWorld: CPS( CPS(world -> world) -> void )
    Jsworld.updateWorld = function(updater, k) {
		var wrappedUpdater = function(w, k2) {
		    try {
				updater(w, k2);
		    } catch (e) {
				handleError(e);
				//k2(w);
		    }
		}

		_js.change_world(wrappedUpdater, k);
    }
    


    // shutdownWorld: -> void
    // Shut down all world computations.
    Jsworld.shutdownWorld = function() {
	_js.shutdown();
    };


//    var getAttribs = function(args) {
//	if (args.length == 0) {
//	    return []
//	}
//	if (args.length == 1) {
//	    return helpers.assocListToHash(args[0]);
//	} else {
//	    throw new Error("getAttribs recevied unexpected value for args: "
//			    + args);
//	}
//    }


    Jsworld.p = _js.p;

    Jsworld.div = _js.div;

    Jsworld.buttonBang = function(updateWorldF, effectF, attribs) {
	var wrappedF = function(w, evt, k) {
	    try {
// FIXME: Get effects back online!
//		caller(effectF, [world],
//			function(effect) {
			    caller(updateWorldF, [w],
				function(newWorld) {
//					world.Kernel.applyEffect(effect);
					k(newWorld);
				});
//			});
	    } catch (e) {
		// if (typeof(console) !== 'undefined' && console.log && e.stack) {
		// 	    console.log(e.stack);
		//     }
		handleError(e);
//		k(w);
	    }
	}
	return _js.button(wrappedF, attribs);
    };
    

    Jsworld.input = function(type, updateF, attribs) {
	    var wrappedUpdater = function(w, evt, k) {
		    caller(updateF, [w, evt], k);
	    }
	    return _js.input(type, wrappedUpdater, attribs);
    };


    Jsworld.get_dash_input_dash_value = function(node) {
//	plt.Kernel.check(node, 
//			 function(x) { return (plt.Kernel.isString(node) ||
//					       node.nodeType == 
//					       Node.ELEMENT_NODE) }, 
//			 "get-input-value",
//			 "dom-node",
//			 1);
	if (types.isString(node)) {
	    return (document.getElementById(node).value || "");
	} else {
	    return (node.value || "");
	}

    };



    // Images.
    Jsworld.img = _js.img;

    // text: string -> node
    Jsworld.text = _js.text;

    Jsworld.select = function(options, updateF, attribs) { 
	    var wrappedUpdater = function(w, e, k) {
		    caller(updateF, [w, e.target.value], k);
	    }
	    return _js.select(attribs, options, wrappedUpdater);
    };




    //////////////////////////////////////////////////////////////////////
    Jsworld.emptyPage = _js.emptyPage;

    Jsworld.placeOnPage = function(elt, left, top, page) { 
	elt = types.toDomNode(deepUnwrapJsObjects(elt));
 	return _js.placeOnPage(elt, left, top, page);
    };


    // fixme: add support for textarea, h1, canvas


//    // raw_node: scheme-value assoc -> node
//    Jsworld.rawNode = function(x, args) {
//	var attribs = getAttribs(args);
//	var node = _js.raw_node(types.toDomNode(x), attribs);
//	node.toWrittenString = function(cache) { return "(js-raw-node ...)"; }
//	node.toDisplayedString = node.toWrittenString;
//	node.toDomNode = function(cache) { return node; }
//	return node;
//    };



})();
