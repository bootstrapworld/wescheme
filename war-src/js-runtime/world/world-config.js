
if (typeof(world) === 'undefined') {
    world = {};
}

(function() {

//     var make_dash_effect_colon_none =
// 	(plt.Kernel.invokeModule("moby/runtime/effect-struct")
// 	 .EXPORTS['make-effect:none']);

    world.config = {};


    // augment: hash hash -> hash
    // Functionally extend a hashtable with another one.
    var augment = function(o, a) {
	var oo = {};
	for (var e in o) {
	    if (Object.hasOwnProperty.call(o, e)) {
		oo[e] = o[e];
	    }
	}
	for (var e in a) {
	    if (Object.hasOwnProperty.call(a, e)) {
		oo[e] = a[e];
	    }
	}
	return oo;
    }



    var WorldConfig = function() {
	// The following handler values are initially false until they're updated
	// by configuration.
      
	// A handler is a function:
	//     handler: world X Y ... -> Z


	this.vals = {
	    // changeWorld: (world -> world) -> void
	    // When called, this will update the world based on the
	    // updater passed to it.
	    changeWorld: false,

	    // shutdownWorld: -> void
	    // When called, this will shut down the world computation.
	    shutdownWorld: false,

	    // initialEffect: effect
	    // The initial effect to invoke when the world computation
	    // begins.
	    initialEffect: false,


	    // onRedraw: world -> scene
	    onRedraw: false,

	    // onDraw: world -> (sexpof dom)
	    onDraw: false,

	    // onDrawCss: world -> (sexpof css-style)
	    onDrawCss: false,


	    // tickDelay: number
	    tickDelay: false,
	    // onTick: world -> world
	    onTick: false,
	    // onTickEffect: world -> effect
	    onTickEffect: false,

	    // onKey: world key -> world
	    onKey: false,
	    // onKeyEffect: world key -> effect
	    onKeyEffect : false,

	    // onMouse: world number number string -> world
	    onMouse: false,
 
	    // onTilt: world number number number -> world
	    onTilt: false,
	    // onTiltEffect: world number number number -> effect
	    onTiltEffect: false,


            // Corresponds to touchstart
	    // onTap: world number number -> world
	    onTap: false,
	    // onTapEffect: world number number -> effect
	    onTapEffect: false,


	    // onAcceleration: world number number number -> world
	    onAcceleration: false,
	    // onAccelerationEffect: world number number number -> effect
	    onAccelerationEffect: false,

	    // onShake: world -> world
	    onShake: false,
	    // onShakeEffect: world -> effect
	    onShakeEffect: false,

	    // onSmsReceive: world -> world
	    onSmsReceive: false,
	    // onSmsReceiveEffect: world -> effect
	    onSmsReceiveEffect: false,

	    // onLocationChange: world number number -> world
	    onLocationChange : false,
	    // onLocationChangeEffect: world number number -> effect
	    onLocationChangeEffect: false,


	    // onAnnounce: world string X ... -> world
	    onAnnounce: false,
	    // onAnnounce: world string X ... -> effect
	    onAnnounceEffect: false,

	    // stopWhen: world -> boolean
	    stopWhen: false,
	    // stopWhenEffect: world -> effect
	    stopWhenEffect: false,



	    //////////////////////////////////////////////////////////////////////
	    // For universe game playing

	    // connectToGame: string
	    // Registers with some universe, given an identifier
	    // which is a URL to a Universe server.
	    connectToGame: false,
	    onGameStart: false,
	    onOpponentTurn: false,
	    onMyTurn: false,
	    afterMyTurn: false,
	    onGameFinish: false
	};
    }

  
    // WorldConfig.lookup: string -> handler
    // Looks up a value in the configuration.
    WorldConfig.prototype.lookup = function(key) {
//	plt.Kernel.check(key, plt.Kernel.isString, "WorldConfig.lookup", "string", 1);
	if (key in this.vals) {
	    return this.vals[key];
	} else {
	    throw Error("Can't find " + key + " in the configuration");
	}
    }
  


    // WorldConfig.updateAll: (hashof string handler) -> WorldConfig
    WorldConfig.prototype.updateAll = function(aHash) {
	var result = new WorldConfig();
	result.vals = augment(this.vals, aHash);
	return result;
    }

  
    world.config.WorldConfig = WorldConfig;

    // The following global variable CONFIG is mutated by either
    // big-bang from the regular world or the one in jsworld.
    world.config.CONFIG = new WorldConfig();


    // A handler is a function that consumes a config and produces a
    // config.


    //////////////////////////////////////////////////////////////////////

    var getNoneEffect = function() {
	throw new Error("getNoneEffect: We should not be calling effects!");
	//	return make_dash_effect_colon_none();
    }



    //////////////////////////////////////////////////////////////////////

    world.config.Kernel = world.config.Kernel || {};
    world.config.Kernel.getNoneEffect = getNoneEffect;


/*
    // makeSimplePropertyUpdater: (string (X -> boolean) string string) -> (X -> handler)
    var makeSimplePropertyUpdater = function(propertyName,
					     propertyPredicate,
					     propertyTypeName,
					     updaterName) {
	return function(val) {
	    plt.Kernel.check(val, propertyPredicate, updaterName, propertyTypeName, 1);
	    return addStringMethods(
		function(config) {
		    return config.updateAll({propertyName: val });
		}, updaterName);
	}
    };

    // connects to the game
    world.config.Kernel.connect_dash_to_dash_game = 
	makeSimplePropertyUpdater('connectToGame',
				  plt.Kernel.isString,
				  "string",
				  "connect-to-game");


    // Registers a handler for game-start events.
    world.config.Kernel.on_dash_game_dash_start = 
	makeSimplePropertyUpdater('onGameStart',
				  plt.Kernel.isFunction,
				  "function",
				  "on-game-start");


    // Registers a handler for opponent-turn events.
    world.config.Kernel.on_dash_opponent_dash_turn = 
	makeSimplePropertyUpdater('onOpponentTurn',
				  plt.Kernel.isFunction,
				  "function",
				  "on-opponent-turn");


    // Registers a handler for my turn.
    world.config.Kernel.on_dash_my_dash_turn = 
	makeSimplePropertyUpdater('onMyTurn',
				  plt.Kernel.isFunction,
				  "function",
				  "on-my-turn");

    // Register a handler after I make a move.
    world.config.Kernel.after_dash_my_dash_turn = 
	makeSimplePropertyUpdater('afterMyTurn',
				  plt.Kernel.isFunction,
				  "function",
				  "after-my-turn");

    world.config.Kernel.on_dash_game_dash_finish = 
	makeSimplePropertyUpdater('onGameFinish',
				  plt.Kernel.isFunction,
				  "function",
				  "on-game-finish");
*/



})();
