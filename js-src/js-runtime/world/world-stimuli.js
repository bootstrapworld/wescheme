// Feeds stimuli inputs into the world.  The functions here
// are responsible for converting to Scheme values.
//
// NOTE and WARNING: make sure to really do the coersions, even for
// strings.  Bad things happen otherwise, as in the sms stuff, where
// we're getting string-like values that aren't actually strings.



(function() {

    world.stimuli = {};

    var handlers = [];

    var doNothing = function() {};


    var StimuliHandler = function(config, caller, restarter) {
	this.config = config;
	this.caller = caller;
	this.restarter = restarter;
	handlers.push(this);
    };

//    StimuliHandler.prototype.failHandler = function(e) {
//	this.onShutdown();
//    	this.restarter(e);
//    };	

    // doStimuli: CPS( (world -> effect) (world -> world) -> void )
    //
    // Processes a stimuli by compute the effect and applying it, and
    // computing a new world to replace the old.
    StimuliHandler.prototype.doStimuli = function(computeEffectF, computeWorldF, restArgs, k) {
	var effectUpdaters = [];
	var that = this;
	try {
	    that.change(function(w, k2) {
		var args = [w].concat(restArgs);
		var doStimuliHelper = function() {
			if (computeWorldF) {
			    that.caller(computeWorldF, args, k2);
			} else {
			    k2(w);
			}
		};
		doStimuliHelper();
	    }, k);
 		// if (computeEffectF) {
// 		    that.caller(computeEffectF, [args],
// 			    function(effect) {
// 			    	effectUpdaters = applyEffect(effect);
// 				doStimuliHelper();
// 			    },
//	    		    this.failHandler);
// 		}
// 		else { doStimuliHelper(); }
// 	    },
// 	    function() {
// 	    	helpers.forEachK(effectUpdaters,
// 				 function(effect, k2) { that.change(effect, k2); },
// 				 function(e) { throw e; },
// 				 k);
// 	    });
	} catch (e) { 
//		if (console && console.log && e.stack) {
//			console.log(e.stack);
//		}
	    this.onShutdown();
	}
    }


    // Orientation change
    // args: [azimuth, pitch, roll]
    StimuliHandler.prototype.onTilt = function(args, k) {
	var onTilt = this.lookup("onTilt");
	var onTiltEffect = this.lookup("onTiltEffect");
	this.doStimuli(onTiltEffect, onTilt, helpers.map(flt, args), k);
    };


    // Accelerations
    // args: [x, y, z]
    StimuliHandler.prototype.onAcceleration = function(args, k) {
	var onAcceleration = this.lookup('onAcceleration');
	var onAccelerationEffect = this.lookup('onAccelerationEffect');
	this.doStimuli(onAccelerationEffect, onAcceleration, helpers.map(flt, args), k);
    };


    // Shakes
    // args: []
    StimuliHandler.prototype.onShake = function(args, k) {
	var onShake = this.lookup('onShake');
	var onShakeEffect = this.lookup('onShakeEffect');
	this.doStimuli(onShakeEffect, onShake, [], k);
    };


    // Sms receiving
    // args: [sender, message]
    StimuliHandler.prototype.onSmsReceive = function(args, k) {
	var onSmsReceive = this.lookup('onSmsReceive');
	var onSmsReceiveEffect = this.lookup('onSmsReceiveEffect');
	// IMPORTANT: must coerse to string by using x+"".  Do not use
	// toString(): it's not safe.
	this.doStimuli(onSmsReceiveEffect, onSmsReceive, [args[0]+"", args[1]+""], k);
    };


    // Locations
    // args: [lat, lng]
    StimuliHandler.prototype.onLocation = function(args, k) {
	var onLocationChange = this.lookup('onLocationChange');
	var onLocationChangeEffect = this.lookup('onLocationChangeEffect');
	this.doStimuli(onLocationChangeEffect, onLocationChange, helpers.map(flt, args), k);
    };



    // Keystrokes
    // args: [e]
    StimuliHandler.prototype.onKey = function(args, k) {
	var keyname = helpers.getKeyCodeName(args[0]);
	var onKey = this.lookup('onKey');
	var onKeyEffect = this.lookup('onKeyEffect');
	this.doStimuli(onKeyEffect, onKey, [keyname], k);
    };



//    // Time ticks
//    // args: []
//    StimuliHandler.prototype.onTick = function(args, k) {
//	var onTick = this.lookup('onTick');
//	var onTickEffect = this.lookup('onTickEffect');
//	this.doStimuli(onTickEffect, onTick, [], k);
//    };



    // Announcements
    // args: [eventName, vals]
    StimuliHandler.prototype.onAnnounce = function(args, k) {
	var vals = args[1];
	var valsList = types.EMPTY;
	for (var i = 0; i < vals.length; i++) {
	    valsList = types.cons(vals[vals.length - i - 1], valsList);
	}

	var onAnnounce = this.lookup('onAnnounce');
	var onAnnounceEffect = this.lookup('onAnnounceEffect');	
	this.doStimuli(onAnnounce, onAnnounceEffect, [args[0], valsList], k);
    };



    // The shutdown stimuli: special case that forces a world computation to quit.
    // Also removes this instance from the list of handlers
    StimuliHandler.prototype.onShutdown = function() {	
	var index = handlers.indexOf(this);
	if (index != -1) {
		handlers.splice(index, 1);
	}

	var shutdownWorld = this.lookup('shutdownWorld');
	if (shutdownWorld) {
	    shutdownWorld();
	}
    };


    //////////////////////////////////////////////////////////////////////
    // Helpers
    var flt = types['float'];
    
    StimuliHandler.prototype.lookup = function(s) {
	return this.config.lookup(s);
    };

    StimuliHandler.prototype.change = function(f, k) {
	if (this.lookup('changeWorld')) {
	    this.lookup('changeWorld')(f, k);
	}
	else { k(); }
    };

    // applyEffect: compound-effect: (arrayof (world -> world))
    var applyEffect = function(e) {
	return world.Kernel.applyEffect(e);
    };

    var makeStimulusHandler = function(funName) {
	    return function() {
		var args = arguments;
		for (var i = 0; i < handlers.length; i++) {
			(handlers[i])[funName](args, doNothing);
		}
//		helpers.forEachK(handlers,
//				 function(h, k) { h[funName](args, k); },
//				 function(e) { throw e; },
//				 doNothing);
	    }
    };

    //////////////////////////////////////////////////////////////////////
    // Exports
    
    world.stimuli.StimuliHandler = StimuliHandler;

    world.stimuli.onTilt = makeStimulusHandler('onTilt');
    world.stimuli.onAcceleration = makeStimulusHandler('onAcceleration');
    world.stimuli.onShake = makeStimulusHandler('onShake');
    world.stimuli.onSmsReceive = makeStimulusHandler('onSmsReceive');
    world.stimuli.onLocation = makeStimulusHandler('onLocation');
    world.stimuli.onKey = makeStimulusHandler('onKey');
//    world.stimuli.onTick = makeStimulusHandler('onTick');
    world.stimuli.onAnnounce = makeStimulusHandler('onAnnounce');

    world.stimuli.massShutdown = function() {
	    for (var i = 0; i < handlers.length; i++) {
		var shutdownWorld = handlers[i].lookup('shutdownWorld');
		if (shutdownWorld) {
		    shutdownWorld();
		}
	    }
	    handlers = [];
    };


})();

