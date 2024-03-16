/*global world, types */
if (typeof(world) === 'undefined') {
    world = {};
}
// Depends on kernel.js, world-config.js, effect-struct.js
(function() {
    'use strict';
    world.Kernel = {};
    var worldListeners = [];
    var stopped;
    var timerInterval = false;

    // Inheritance from pg 168: Javascript, the Definitive Guide.
    var heir = function(p) {
        var f = function() {};
        f.prototype = p;
        return new f();
    };

    // clone: object -> object
    // Copies an object.  The new object should respond like the old
    // object, including to things like instanceof
    var clone = function(obj) {
        var C = function() {};
        var property;
        C.prototype = obj;
        var c = new C();
        for (property in obj) {
            if (Object.hasOwnProperty.call(obj, property)) {
                c[property] = obj[property];
            }
        }
        return c;
    };

    var announceListeners = [];
    world.Kernel.addAnnounceListener = function(listener) {
        announceListeners.push(listener);
    };
    world.Kernel.removeAnnounceListener = function(listener) {
        var idx = announceListeners.indexOf(listener);
        if (idx !== -1) {
            announceListeners.splice(idx, 1);
        }
    };
    world.Kernel.announce = function(eventName, vals) {
        var i;
        for (i = 0; i < announceListeners.length; i++) {
            try {
                announceListeners[i](eventName, vals);
            } catch (e) {}
        }
    };


    // changeWorld: world -> void
    // Changes the current world to newWorld.
    var changeWorld = function(newWorld) {
        world = newWorld;
        notifyWorldListeners();
    };


    // updateWorld: (world -> world) -> void
    // Public function: update the world, given the old state of the
    // world.
    world.Kernel.updateWorld = function(updater) {
        var newWorld = updater(world);
        changeWorld(newWorld);
    };


    world.Kernel.shutdownWorld = function() {
        stopped = true;
    };


    // notifyWorldListeners: -> void
    // Tells all of the world listeners that the world has changed.
    var notifyWorldListeners = function() {
        var i;
        for (i = 0; i < worldListeners.length; i++) {
            worldListeners[i](world);
        }
    };

    // addWorldListener: (world -> void) -> void
    // Adds a new world listener: whenever the world is changed, the aListener
    // will be called with that new world.
    var addWorldListener = function(aListener) {
        worldListeners.push(aListener);
    };


    // resetWorld: -> void
    // Resets all of the world global values.
    var resetWorld = function() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = false;
        }
        stopped = false;
        worldListeners = [];
    };


    var getBigBangWindow = function(width, height) {
        if (window.document.getElementById("canvas") !== undefined) {
            return window;
        }

        var newWindow = window.open(
            "big-bang.html",
            "big-bang");
        //"toolbar=false,location=false,directories=false,status=false,menubar=false,width="+width+",height="+height);
        if (newWindow === null) {
            throw new Error("Error: Not allowed to create a new window."); }

        return newWindow;
    };

    // scheduleTimerTick: -> void
    // Repeatedly schedules an evaluation of the onTick until the program has stopped.
    var scheduleTimerTick = function(window, config) {
        timerInterval = window.setInterval(
            function() {
                if (stopped) {
                    window.clearTimeout(timerInterval);
                    timerInterval = false;
                }
                else {
                    world.Kernel.stimuli.onTick();
                }
            },
            config.lookup('tickDelay'));
    };
 
    // given two arrays of {x,y} structs, determine their equivalence
    var verticesEqual = function(v1, v2){
        if(v1.length !== v2.length){ return false; }
        var v1_str = v1.map(function(o){return "x:"+o.x+",y:"+o.y}).join(","),
            v2_str = v2.map(function(o){return "x:"+o.x+",y:"+o.y}).join(",");
        // v1 == rot(v2) if append(v1,v1) includes v2
        return (v1_str+","+v1_str).includes(v2_str);
    };

    // given an array of (x, y) pairs, unzip them into separate arrays
    var unzipVertices = function(vertices){
        return {xs: vertices.map(function(v) { return v.x }),
                ys: vertices.map(function(v) { return v.y })};
    };
    // given an array of vertices, find the width of the shape
    var findWidth = function(vertices){
        var xs = unzipVertices(vertices).xs;
        return Math.max.apply(Math, xs) - Math.min.apply(Math, xs);
    }
    // given an array of vertices, find the height of the shape
    var findHeight = function(vertices){
        var ys = unzipVertices(vertices).ys;
        return Math.max.apply(Math, ys) - Math.min.apply(Math, ys);
    }

    // given a list of vertices and a translationX/Y, shift them
    var translateVertices = function(vertices) {
        var vs = unzipVertices(vertices);
        var translateX = -Math.min.apply( Math, vs.xs );
        var translateY = -Math.min.apply( Math, vs.ys );
        return vertices.map(function(v) {
            return {x: v.x + translateX, y: v.y + translateY };
        })
    }

    // Base class for all images.
    var BaseImage = function() {};
    world.Kernel.BaseImage = BaseImage;


    var isImage = function(thing) {
        return (thing !== null &&
                thing !== undefined &&
                thing instanceof BaseImage);
    };
    /*
    // almost certainly dead code
    BaseImage.prototype.updatePinhole = function(x, y) {
        var aCopy = clone(this);
        aCopy.pinholeX = x;
        aCopy.pinholeY = y;
        return aCopy;
    };
    */
    // return Integer-only height for the getter methods
    BaseImage.prototype.getHeight = function(){
        return Math.round(this.height);
    };
    BaseImage.prototype.getWidth = function(){
        return Math.round(this.width);
    };
    BaseImage.prototype.getBaseline = function(){
        return Math.round(this.height);
    };

    // return the vertex array if it exists, otherwise make one using height and width
    BaseImage.prototype.getVertices = function(){
        if(this.vertices){ return this.vertices; }
        else{ return [{x:0 , y: 0},
                      {x: this.width, y: 0},
                      {x: 0, y: this.height},
                      {x: this.width, y: this.height}]; }
    };

    // render: context fixnum fixnum: -> void
    // Render the image, where the upper-left corner of the image is drawn at
    // (x, y).
    // If the image isn't vertex-based, throw an error
    // Otherwise, stroke and fill the vertices.
    BaseImage.prototype.render = function(ctx, x, y) {
        if(!this.vertices){
            throw new Error('BaseImage.render is not implemented for this type!');
        }
        ctx.save();
        ctx.beginPath();

        // we care about the stroke because drawing to a canvas is *different* for
        // fill v. stroke! If it's fill, we can draw on the pixel boundaries and
        // stroke within them. If it's outline, we need to draw _inside_ those 
        // boundaries, adjusting by a half-pixel towards the center.
        var isSolid = this.style.toString().toLowerCase() !== "outline";

        var vertices;
        // pixel-perfect vertices fail on Chrome, and certain versions of FF,
        // so we disable the offset for equality tests and solid images
        if(ctx.isEqualityTest || isSolid){
            vertices = this.vertices;
        } else {
            // find the midpoint of the xs and ys from vertices
            var midX = findWidth(this.vertices)  / 2;
            var midY = findHeight(this.vertices) / 2;

            // compute 0.5px offsets to ensure that we draw on the pixel
            // and not the pixel boundary
            vertices = this.vertices.map(function(v){
                return {x: v.x + (v.x < midX ? 0.5 : -0.5),
                        y: v.y + (v.y < midY ? 0.5 : -0.5)};
            });
        }
        
        // draw a path from vertex to vertex
        ctx.moveTo( x+vertices[0].x, y+vertices[0].y );
        vertices.forEach(function(v){ ctx.lineTo( x + v.x, y + v.y); });
        ctx.closePath();
       
        if (isSolid) {
            ctx.fillStyle = colorString(this.color, this.style);
            ctx.fill();
        } else {
            ctx.strokeStyle = colorString(this.color);
            ctx.stroke();
        }
        ctx.restore();
    };


    // makeCanvas: number number -> canvas
    // Constructs a canvas object of a particular width and height.
    world.Kernel.makeCanvas = makeCanvas = function(width, height) {
        var canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.style.width  = canvas.width  + "px";
        canvas.style.height = canvas.height + "px"; 
        return canvas;
    };

    BaseImage.prototype.toDomNode = function(cache) {
        var that = this;
        var width = that.getWidth();
        var height = that.getHeight();
        var canvas = world.Kernel.makeCanvas(width, height);
        var ctx;

        // KLUDGE: on IE, the canvas rendering functions depend on a
        // context where the canvas is attached to the DOM tree.
        // We initialize an afterAttach hook; the client's responsible
        // for calling this after the dom node is attached to the
        // document.
        canvas.afterAttach = function() {
            ctx = canvas.getContext("2d");
            that.render(ctx, 0, 0);
        };
        canvas.ariaText = this.getAriaText(BaseImage.ariaNestingDepth);
        return canvas;
    };
    // don't bother reading descriptions of images nested deeper than 6
    BaseImage.ariaNestingDepth = 6;

    BaseImage.prototype.toWrittenString = function(cache) { return "<image>"; };
    BaseImage.prototype.toDisplayedString = this.toWrittenString;
    BaseImage.prototype.getAriaText = function(depth) { return "image"; }

    // Best-Guess equivalence for images. If they're vertex-based we're in luck,
    // otherwise we go pixel-by-pixel. It's up to exotic image types to provide
    // more efficient ways of comparing one another
    BaseImage.prototype.isEqual = function(other, aUnionFind) {
      if(!(other instanceof BaseImage) ||
         this.getWidth()  !== other.getWidth()    ||
         this.getHeight() !== other.getHeight()){ return false; }

      // FAST PATH: if they're both vertex-based images, compare
      // their styles, vertices and colors.
      // * Also checks for rotations of otherwise-identical vertices
      if(   (this.vertices && other.vertices)
         && (this.style    === other.style)
         && (types.isEqual(this.color, other.color, aUnionFind))
         && (verticesEqual(this.vertices, other.vertices))) {
            console.log('Using fast path for image equality check');
            return true;
      }

      // SLOW PATH: render both images to canvases
      // First check canvas dimensions, then hash both images and compare
      console.log('Using slow path for image equality check');
      var c1 = this.toDomNode(), c2 = other.toDomNode();
      c1.style.visibility = c2.style.visibility = "hidden";
      if(c1.width !== c2.width || c1.height !== c2.height){ return false;}
      try{
        var ctx1 = c1.getContext('2d'), ctx2 = c2.getContext('2d');
        ctx1.isEqualityTest = true;
        ctx2.isEqualityTest = true;
        this.render(ctx1, 0, 0); other.render(ctx2, 0, 0);
        // create temporary canvases
        var slice1 = document.createElement('canvas').getContext('2d'),
            slice2 = document.createElement('canvas').getContext('2d');
        var tileW = Math.min(10000, c1.width); // use only the largest tiles we need for these images
        var tileH = Math.min(10000, c1.height);
        for (var y=0; y < c1.height; y += tileH){
            for (var x=0; x < c1.width; x += tileW){
                tileW = Math.min(tileW, c1.width - x); // can we use smaller tiles for what's left?
                tileH = Math.min(tileH, c1.height- y);
                slice1.canvas.width  = slice2.canvas.width  = tileW;
                slice1.canvas.height = slice2.canvas.height = tileH;
                console.log('processing chunk from ('+x+','+y+') to ('+(x+tileW)+','+(y+tileH)+')');
                slice1.clearRect(0, 0, tileW, tileH);
                slice1.drawImage(c1, x, y, tileW, tileH, 0, 0, tileW, tileH);
                slice2.clearRect(0, 0, tileW, tileH);
                slice2.drawImage(c2, x, y, tileW, tileH, 0, 0, tileW, tileH);
                var d1 = slice1.canvas.toDataURL(),
                    d2 = slice2.canvas.toDataURL(),
                    h1 = world.md5(d1),  h2 = world.md5(d2);
                if(h1 !== h2) return false;
            }
        }
      // Slow-path can fail with CORS or image-loading problems
      } catch(e){
        console.log('Couldn\'t compare images:', e);
        return false;
      }
      // if, after all this, we're still good...then they're equal!
      return true;
    };

    // isScene: any -> boolean
    // Produces true when x is a scene.
    var isScene = function(x) {
        return ((x !== undefined) && (x !== null) && (x instanceof SceneImage));
    };

    //////////////////////////////////////////////////////////////////////
    // SceneImage: primitive-number primitive-number (listof image) boolean color -> Scene
    var SceneImage = function(width, height, children, withBorder, color) {
        BaseImage.call(this);
        this.width    = width;
        this.height   = height;
        this.children = children; // arrayof [image, number, number]
        this.withBorder = withBorder;
        this.color    = color;
    };
    SceneImage.prototype = heir(BaseImage.prototype);

    // add: image primitive-number primitive-number -> Scene
    SceneImage.prototype.add = function(anImage, x, y) {
        return new SceneImage(this.width, 
                              this.height,
                              this.children.concat([[anImage, 
                                                     x - anImage.getWidth()/2,
                                                     y - anImage.getHeight()/2]]),
                              this.withBorder,
                              this.color);
    };

    SceneImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "scene image";
        var ariaText = " a Scene that is "+this.width+" by "+this.height+". children are: ";
        ariaText += this.children.map(function(c,i){
          return "child "+(i+1)+": "+c[0].getAriaText(depth - 1)+", positioned at "+c[1]+","+c[2]+" ";
        }).join(". ");
        return ariaText;
    }

    // render: 2d-context primitive-number primitive-number -> void
    SceneImage.prototype.render = function(ctx, x, y) {
        var childImage, childX, childY;
        // create a clipping region around the boundaries of the Scene
        ctx.save();
        ctx.fillStyle = this.color? colorString(this.color) : "transparent";
        ctx.fillRect(x, y, this.width, this.height);
        ctx.restore();
        // save the context, reset the path, and clip to the path around the scene edge
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, this.width, this.height);
        ctx.clip();
        // Ask every object to render itself inside the region
        this.children.forEach(function(child) { 
            // then, render the child images
            childImage = child[0];
            childX = child[1];
            childY = child[2];
            childImage.render(ctx, childX + x, childY + y);
        });
        // unclip
        ctx.restore();

        if (this.withBorder) {
            ctx.strokeStyle = 'black';
            ctx.strokeRect(x, y, this.width, this.height);
        }
    };

    SceneImage.prototype.isEqual = function(other, aUnionFind) {
        return (other instanceof SceneImage     &&
                this.width    == other.width    &&
                this.height   == other.height   &&
                this.children.length == other.children.length && 
                this.children.every(function(child1, i) {
                    var child2 = other.children[i];
                    return (child1[1] == child2[1] &&
                            child1[2] == child2[2] &&
                            types.isEqual(child1[0], child2[0], aUnionFind));
                }))
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };


    //////////////////////////////////////////////////////////////////////
    // FileImage: string node -> Image
    var FileImage = function(src, rawImage, afterInit) {
        BaseImage.call(this);
        var self = this;
        this.src = src;
        this.isLoaded = false;
        this.originalURI = decodeURIComponent(src).slice(16);
        this.labeled = false;

        // animationHack: see installHackToSupportAnimatedGifs() for details.
        this.animationHackImg = undefined;

        function onImgLoad() {
            self.isLoaded = true;
            self.width = self.img.width;
            self.height = self.img.height;
        }

        if (rawImage && rawImage.complete) {
            self.img = rawImage;
            onImgLoad();
        } else {
            // fixme: we may want to do something blocking here for
            // onload, since we don't know at this time what the file size
            // should be, nor will drawImage do the right thing until the
            // file is loaded.
            self.img = new Image();
            self.img.onload = onImgLoad;
            self.img.onerror = function(e) {
                self.img.onerror = "";
                self.img.src = "http://www.wescheme.org/images/broken.png";
            };
            self.img.src = src;
        }
        this.installHackToSupportAnimatedGifs(afterInit);
    };
    FileImage.prototype = heir(BaseImage.prototype);

    FileImage.prototype.getAriaText = function(depth) {
        return imageCache && imageCache[this.originalURI] && imageCache[this.originalURI].labeled? 
            imageCache[this.originalURI].getAriaText()
            : " an image file from "+this.originalURI;
    }

    // set up the cache, and look for images that need describing every 5 sec
    var imageCache = {};
    var VISION_API_TIMEOUT = 5000;
    var visionAPITimer = window.myEditor? setTimeout(describeImagesInCache, VISION_API_TIMEOUT) : null;

    function describeImagesInCache() {
        visionAPITimer = setTimeout(describeImagesInCache, VISION_API_TIMEOUT);

        if(!myEditor.getScreenreader()) return;
        // collect all undescribed fileImages in an array
        var undescribedImages = [];
        for (var src in imageCache) {
            if (imageCache.hasOwnProperty(src) && !imageCache[src].labeled) {
                undescribedImages.push(imageCache[src]);
            }
        }
        // bail if there's no work to be done
        if(undescribedImages.length === 0) return;

        // do some work! create a batch request for all undescribed images
        var requests = [];
        undescribedImages.forEach(function(img) {
          requests.push(  { image: { source: { imageUri: img.originalURI } }, 
                            features: [{type: "LABEL_DETECTION", maxResults: 10}]});
        });
        var CONFIDENCE_THRESHOLD = 0.75;
        var jsonString = JSON.stringify({requests: requests});
        try {
            var xhr = new XMLHttpRequest();
            xhr.onload = function() { 
                var data = JSON.parse(this.responseText);
                if(!data.responses) {
                    VISION_API_TIMEOUT *= 2; // Decay
                    console.log('no response from VisionAPI. set timeout to ', VISION_API_TIMEOUT, 'ms');
                    throw "No response from Google Vision API";
                } else {
                    console.log('successful load from VisionAPI. set timeout to ', VISION_API_TIMEOUT, 'ms');
                    VISION_API_TIMEOUT = 5000; //reset time to default 5sec
                }
                data.responses.forEach(function(response, i) {
                    // sort labels by *descending* confidence (in-place!), then grab the
                    // label with the highest confidence
                    response.labelAnnotations.sort(function(label1, label2){
                        return (label1.confidence < label2.confidence)? 1 : -1; // descending order!
                    });
                    var bestLabel = response.labelAnnotations[0].description;
                    // update the FileImage in the imageCache
                    imageCache[undescribedImages[i].originalURI].labeled = true;
                    imageCache[undescribedImages[i].originalURI].getAriaText = function() { 
                        " a picture of a "+bestLabel;
                    };
                });
                console.log('after load(), timeout is', VISION_API_TIMEOUT);
            }
            xhr.onerror = function () { console.log("Google VisionAPI post() failure"); }
            xhr.open('POST', "https://vision.googleapis.com/v1/images:annotate?key="+plt.config.API_KEY);
            xhr.setRequestHeader("content-type", "application/json");
            xhr.send(jsonString);
        } catch (e) {
            console.log('Setting up XHR for Google Vision API failed', e);
            VISION_API_TIMEOUT *= 2; // Decay
        }
    }

    FileImage.makeInstance = function(path, rawImage, afterInit) {
        var uri = decodeURIComponent(path).slice(16); // get the original URI
        if (! (uri in imageCache)) {
            imageCache[uri] = new FileImage(path, rawImage, afterInit);
            return imageCache[uri];
        } else {
            afterInit(imageCache[uri]);
            return imageCache[uri];
        }
    };

    FileImage.prototype.render = function(ctx, x, y) {
        var self = this;
        ctx.drawImage(self.animationHackImg, x, y);
        setTimeout(function(){
            //ctx.canvas.setAttribute('aria-label', self.getAriaText());
            //ctx.canvas.ariaText = self.getAriaText();
        }, 5000);
    };

    // The following is a hack that we use to allow animated gifs to show
    // as animating on the canvas. They have to be added to the DOM as *images*
    // in order to have their frames fed to the canvas, so we add them someplace hidden
    FileImage.prototype.installHackToSupportAnimatedGifs = function(afterInit) {
        var that = this;
        this.animationHackImg = this.img.cloneNode(true);
        document.body.appendChild(this.animationHackImg);
        this.animationHackImg.style.position = 'absolute';
        this.animationHackImg.style.top = '-50000px';
 
        if (this.animationHackImg.complete) {
            afterInit(that);
        } else {
            this.animationHackImg.onload = function() {
                afterInit(that);
            };
        }
    };

    FileImage.prototype.getWidth = function() {
        return Math.round(this.img.width);
    };

    FileImage.prototype.getHeight = function() {
        return Math.round(this.img.height);
    };

    FileImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof FileImage) && this.src === other.src)
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };

    //////////////////////////////////////////////////////////////////////
    // fileVideo: String Node -> Video
    var FileVideo = function(src, rawVideo) {
        BaseImage.call(this);
        var self = this;
        this.src = src;
        if (rawVideo) {
            this.video                  = rawVideo;
            this.width                  = self.video.videoWidth;
            this.height                 = self.video.videoHeight;
            this.video.volume           = 1;
            this.video.poster           = "http://www.wescheme.org/images/broken.png";
            this.video.autoplay         = true;
            this.video.autobuffer       = true;
            this.video.loop             = true;
            this.video.play();
        } else {
            // fixme: we may want to do something blocking here for
            // onload, since we don't know at this time what the file size
            // should be, nor will drawImage do the right thing until the
            // file is loaded.
            this.video = document.createElement('video');
            this.video.src = src;
            this.video.addEventListener('canplay', function() {
                this.width              = self.video.videoWidth;
                this.height             = self.video.videoHeight;
                this.video.poster       = "http://www.wescheme.org/images/broken.png";
                this.video.autoplay     = true;
                this.video.autobuffer   = true;
                this.video.loop         = true;
                this.video.play();
            });
            this.video.addEventListener('error', function(e) {
                self.video.onerror = "";
                self.video.poster = "http://www.wescheme.org/images/broken.png";
            });
        }
    };
    FileVideo.prototype = heir(BaseImage.prototype);

    FileVideo.prototype.getAriaText = function(depth) {
        return " a video file from "+decodeURIComponent(this.src).slice(16);
    }

    var videoCache = {};
    FileVideo.makeInstance = function(path, rawVideo) {
        if (! (path in FileVideo)) {
            videoCache[path] = new FileVideo(path, rawVideo);
        } 
        return videoCache[path];
    };

    FileVideo.prototype.render = function(ctx, x, y) {
        ctx.drawImage(this.video, x, y);
    };
    FileVideo.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof FileVideo) && this.src === other.src)
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };
 

    //////////////////////////////////////////////////////////////////////
    // FileAudio: String Node -> Video
    var FileAudio = function(src, loop, rawAudio) {
        this.src = src;
        var that = this;
        if (rawAudio && (rawAudio.readyState===4)) {
            that.audio                  = rawAudio;
            that.audio.autoplay         = true;
            that.audio.autobuffer       = true;
            that.audio.currentTime      = 0;
            that.audio.loop             = loop;
            that.audio.play();
        } else {
            // fixme: we may want to do something blocking here for
            // onload, since we don't know at this time what the file size
            // should be, nor will drawImage do the right thing until the
            // file is loaded.
            that.audio = document.createElement('audio');
            that.audio.src = src;
            that.audio.addEventListener('canplay', function() {
                that.audio.autoplay     = true;
                that.audio.autobuffer   = true;
                that.audio.currentTime  = 0;
                that.audio.loop         = loop;
                that.audio.play();
            });
        }
        return true;
    };
    var audioCache = {};
    FileAudio.makeInstance = function(path, loop, rawAudio) {
        if (! (path in audioCache)) {
            audioCache[path] = new FileAudio(path, loop, rawAudio, afterInit);
            return audioCache[path];
        } else {
            audioCache[path].audio.play();
            afterInit(audioCache[path]);
            return audioCache[path];
        }
        return new FileAudio(path, loop, rawAudio);
    };
 
    //////////////////////////////////////////////////////////////////////
    // ImageDataImage: imageData -> image
    // Given an array of pixel data, create an image
    var ImageDataImage = function(imageData) {
        BaseImage.call(this);
        this.imageData= imageData;
        this.width    = imageData.width;
        this.height   = imageData.height;
    };
 
    ImageDataImage.prototype = heir(BaseImage.prototype);
 
    ImageDataImage.prototype.render = function(ctx, x, y) {
        ctx.putImageData(this.imageData, x, y);
    };

    //////////////////////////////////////////////////////////////////////
    // OverlayImage: image image placeX placeY -> image
    // Creates an image that overlays img1 on top of the
    // other image img2.
    var OverlayImage = function(img1, img2, placeX, placeY) {
        BaseImage.call(this);

        // An overlay image consists of width, height, x1, y1, x2, and
        // y2.  We need to compute these based on the inputs img1,
        // img2, placex, and placey.

        // placeX and placeY may be non-numbers, in which case their values
        // depend on the img1 and img2 geometry.
        
        var x1, y1, x2, y2;

        if (placeX === "left") {
            x1 = 0;
            x2 = 0;
        } else if (placeX === "right") {
            x1 = Math.max(img1.width, img2.width) - img1.width;
            x2 = Math.max(img1.width, img2.width) - img2.width;
        } else if (placeX === "beside") {
            x1 = 0;
            x2 = img1.width;
        } else if (placeX === "middle" || placeX === "center") {
            x1 = Math.max(img1.width, img2.width)/2 - img1.width/2;
            x2 = Math.max(img1.width, img2.width)/2 - img2.width/2;
        } else {
            x1 = Math.max(placeX, 0) - placeX;
            x2 = Math.max(placeX, 0);
        }
        
        if (placeY === "top") {
            y1 = 0;
            y2 = 0;
        } else if (placeY === "bottom") {
            y1 = Math.max(img1.height, img2.height) - img1.height;
            y2 = Math.max(img1.height, img2.height) - img2.height;
        } else if (placeY === "above") {
            y1 = 0;
            y2 = img1.height;
        } else if (placeY === "baseline") {
            y1 = Math.max(img1.getBaseline(), img2.getBaseline()) - img1.getBaseline();
            y2 = Math.max(img1.getBaseline(), img2.getBaseline()) - img2.getBaseline();
        } else if (placeY === "middle" || placeY === "center") {
            y1 = Math.max(img1.height, img2.height)/2 - img1.height/2;
            y2 = Math.max(img1.height, img2.height)/2 - img2.height/2;
        } else {
            y1 = Math.max(placeY, 0) - placeY;
            y2 = Math.max(placeY, 0);
        }

        // calculate the vertices of this image by translating the vertices of the sub-images
        var i, v1 = img1.getVertices(), v2 = img2.getVertices(), xs = [], ys = [];
        v1 = v1.map(function(v){ return {x: v.x + x1, y: v.y + y1}; });
        v2 = v2.map(function(v){ return {x: v.x + x2, y: v.y + y2}; });
        
        // store the vertices as something private, so this.getVertices() will still return undefined
        this._vertices = v1.concat(v2);

        // store the offsets for rendering
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.img1 = img1;
        this.img2 = img2;
        var positionText;
        if((["middle","center"].indexOf(placeX)>-1) && (["middle","center"].indexOf(placeY)>-1)){
          positionText = " centered ";
        } else if(placeX==="left"){
          positionText = " left-aligned ";
        } else if(placeX==="right"){
          positionText = " right-aligned ";
        } else if(placeX==="beside"){
          positionText = " beside ";
        } else if(!isNaN(placeX)){
          positionText = " shifted left by "+placeX;
        }
        if(placeY==="top"){
          positionText += " top-aligned ";
        } else if(placeY==="bottom"){
          positionText += " bottom-aligned ";
        } else if(placeY==="above"){
          positionText += " above ";
        } else if(!isNaN(placeY)){
          positionText += " , shifted up by "+placeY;
        }
        this.width  = findWidth(this._vertices);
        this.height = findHeight(this._vertices);
        this.positionText = positionText;
    };

    OverlayImage.prototype = heir(BaseImage.prototype);
 
    OverlayImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "overlay image";
        return " an overlay: " + this.img1.getAriaText(depth - 1) 
            + this.positionText + " above " + this.img2.getAriaText(depth - 1);
    };

    OverlayImage.prototype.getVertices = function() { return this._vertices; };
 
    OverlayImage.prototype.render = function(ctx, x, y) {
        ctx.save();
        this.img2.render(ctx, x + this.x2, y + this.y2);
        this.img1.render(ctx, x + this.x1, y + this.y1);
        ctx.restore();
    };

    // try the fast-path (structural equality), fail to the slow path
    OverlayImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof OverlayImage) &&
                this.width     === other.width  &&
                this.height    === other.height &&
                this.x1        === other.x1     &&
                this.y1        === other.y1     &&
                this.x2        === other.x2     &&
                this.y2        === other.y2     &&
                types.isEqual(this.img1, other.img1, aUnionFind) &&
                types.isEqual(this.img2, other.img2, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };


    //////////////////////////////////////////////////////////////////////
    // rotate: angle image -> image
    // Rotates image by angle degrees in a counter-clockwise direction.
    var RotateImage = function(angle, img) {
        BaseImage.call(this);
        // optimization for trying to rotate a circle
        if((img instanceof EllipseImage) && (img.width == img.height)){
            angle = 0;
        }
        var sin   = Math.sin(angle * Math.PI / 180);
        var cos   = Math.cos(angle * Math.PI / 180);
        
        // rotate each point as if it were rotated about (0,0)
        var vertices = img.getVertices().map(function(v) {
            return {x: v.x*cos - v.y*sin, y: v.x*sin + v.y*cos };
        });

        // extract the xs and ys separately
        var vs = unzipVertices(vertices);
        
        // store the vertices as something private, so this.getVertices() will still return undefined
        this._vertices  = translateVertices(vertices);
        this.img        = img;
        this.width      = findWidth(vertices);
        this.height     = findHeight(vertices);
        this.angle      = Math.round(angle);
        this.translateX = -Math.min.apply( Math, vs.xs );
        this.translateY = -Math.min.apply( Math, vs.ys );
    };

    RotateImage.prototype = heir(BaseImage.prototype);

    RotateImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "rotated image";
        return "Rotated image, "+(-1 * this.angle)+" degrees: "+this.img.getAriaText(depth - 1);
    };

    RotateImage.prototype.getVertices = function() { return this._vertices; };

    // translate the canvas using the calculated values, then draw at the rotated (x,y) offset.
    RotateImage.prototype.render = function(ctx, x, y) {
        ctx.save();
        ctx.translate(x + this.translateX, y + this.translateY);
        ctx.rotate(this.angle * Math.PI / 180);
        this.img.render(ctx, 0, 0);
        ctx.restore();
    };

    // try the fast-path (structural equality), fail to the slow path
    RotateImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof RotateImage)      &&
                this.width     === other.width      &&
                this.height    === other.height     &&
                this.angle     === other.angle      &&
                this.translateX=== other.translateX &&
                this.translateY=== other.translateY &&
                types.isEqual(this.img, other.img, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };

    //////////////////////////////////////////////////////////////////////
    // ScaleImage: factor factor image -> image
    // Scale an image
    var ScaleImage = function(xFactor, yFactor, img) {
        BaseImage.call(this);

        // grab the img vertices, scale them, and save the result to this_vertices
        this._vertices = img.getVertices().map(function(v) {
            return {x: v.x * xFactor, y: v.y * yFactor };
        });
 
        this.img      = img;
        this.width    = img.width  * xFactor;
        this.height   = img.height * yFactor;
        this.xFactor  = xFactor;
        this.yFactor  = yFactor;
    };

    ScaleImage.prototype = heir(BaseImage.prototype);


    ScaleImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "scaled image";
        return "Scaled Image, "+
            (this.xFactor===this.yFactor
            ? "by "+this.xFactor
            : "horizontally by "+this.xFactor+" and vertically by "+this.yFactor)+". " +
        this.img.getAriaText(depth - 1);
    };

    ScaleImage.prototype.getVertices = function() { return this._vertices; };

    // scale the context, and pass it to the image's render function
    ScaleImage.prototype.render = function(ctx, x, y) {
        ctx.save();
        ctx.scale(this.xFactor, this.yFactor);
        this.img.render(ctx, x / this.xFactor, y / this.yFactor);
        ctx.restore();
    };

    ScaleImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof ScaleImage)       &&
                this.width     === other.width      &&
                this.height    === other.height     &&
                this.xFactor   === other.xFactor    &&
                this.yFactor   === other.yFactor    &&
                types.isEqual(this.img, other.img, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };

    //////////////////////////////////////////////////////////////////////
    // CropImage: startX startY width height image -> image
    // Crop an image
    var CropImage = function(x, y, width, height, img) {
        BaseImage.call(this);
        this.x          = x;
        this.y          = y;
        this.width      = width;
        this.height     = height;
        this.img        = img;
    };

    CropImage.prototype = heir(BaseImage.prototype);


    CropImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "cropped image";
        return "Cropped image, from "+this.x+", "+this.y+" to "+(this.x+this.width)+", "+(this.y+this.height)+": "+this.img.getAriaText(depth - 1);
    };

    CropImage.prototype.render = function(ctx, x, y) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, this.width, this.height);
        ctx.clip();
        ctx.translate(-this.x, -this.y);
        this.img.render(ctx, x, y);
        ctx.restore();
    };

    CropImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof CropImage)    &&
                this.width     === other.width  &&
                this.height    === other.height &&
                this.x         === other.x      &&
                this.y         === other.y      &&
                types.isEqual(this.img, other.img, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };

    //////////////////////////////////////////////////////////////////////
    // FrameImage: factor factor image -> image
    // Stick a frame around the image
    var FrameImage = function(img) {
        BaseImage.call(this);
        this.img        = img;
        this.width      = img.width;
        this.height     = img.height;
    };

    FrameImage.prototype = heir(BaseImage.prototype);


    FrameImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "framed image";
        return " Framed image: "+this.img.getAriaText(depth - 1);
    };

    // scale the context, and pass it to the image's render function
    FrameImage.prototype.render = function(ctx, x, y) {
        ctx.save();
        this.img.render(ctx, x, y);
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.strokeRect(x, y, this.width, this.height);
        ctx.closePath();
        ctx.restore();
    };

    FrameImage.prototype.isEqual = function(other, aUnionFind) {
        return (other instanceof FrameImage &&
                types.isEqual(this.img, other.img, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };

    //////////////////////////////////////////////////////////////////////
    // FlipImage: image string -> image
    // Flip an image either horizontally or vertically
    var FlipImage = function(img, direction) {
        BaseImage.call(this);
        this.img        = img;
        this.width      = img.getWidth();
        this.height     = img.getHeight();
        this.direction  = direction;
    };

    FlipImage.prototype = heir(BaseImage.prototype);


    FlipImage.prototype.getAriaText = function(depth) {
        if (depth <= 0) return "flipped image";
        return indefiniteArticle(this.direction)+"ly flipped image: " 
            + this.img.getAriaText(depth - 1);
    };

    FlipImage.prototype.render = function(ctx, x, y) {
        // when flipping an image of dimension M and offset by N across an axis, 
        // we need to translate the canvas by M+2N in the opposite direction
        ctx.save();
        if(this.direction === "horizontal"){
            ctx.scale(-1, 1);
            ctx.translate(-(this.width+2*x), 0);
        }
        if (this.direction === "vertical"){
            ctx.scale(1, -1);
            ctx.translate(0, -(this.height+2*y));
        }
        this.img.render(ctx, x, y);
        ctx.restore();
    };

    FlipImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof FlipImage)        &&
                this.width     === other.width      &&
                this.height    === other.height     &&
                this.direction === other.direction  &&
                types.isEqual(this.img, other.img, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };


    //////////////////////////////////////////////////////////////////////
    // colorString : hexColor Style -> rgba
    // Style can be "solid" (1.0), "outline" (1.0), a number (0-1.0) or null (1.0)
    var colorString = function(aColor, aStyle) {
      var styleAlpha = isNaN(aStyle)? 1.0 : aStyle/255,
          colorAlpha = types.colorAlpha(aColor)/255;
      return "rgba(" +  types.colorRed(aColor)   + ", " +
                        types.colorGreen(aColor) + ", " +
                        types.colorBlue(aColor)  + ", " +
                        styleAlpha * colorAlpha  + ")";
    };
 
    //////////////////////////////////////////////////////////////////////
    // indefiniteArticle : String -> String
    // Prepend "a" or "an" to the given string, depending on whether it
    // starts with a vowel
    function indefiniteArticle(str) {
        str = str.replace(/^\s*/, ""); // strip any leading whitespace
        return (str.match(/^[aeiouAEIOU]/)? " an " : " a ") + str;
    }
    

    //////////////////////////////////////////////////////////////////////
    // colorToSpokenString : hexColor Style -> String
    // Describes the color using the nearest HTML color name
    // Style can be "solid" (1.0), "outline" (1.0), a number (0-1.0) or null (1.0)
    function colorToSpokenString(aColor, aStyle){
      if(aStyle===0) return " transparent ";
      var lab1 = RGBtoLAB(types.colorRed(aColor),
                          types.colorGreen(aColor),
                          types.colorBlue(aColor));
      var distances = world.Kernel.colorLabs.map(function(lab2){
              return {l: lab2.l, a: lab2.a, b:lab2.b, name: lab2.name,
                      d: Math.sqrt(Math.pow(lab1.l-lab2.l,2)
                                   +Math.pow(lab1.a-lab2.a,2)
                                   +Math.pow(lab1.b-lab2.b,2))}});
      var distances = distances.sort(function(a,b){return a.d<b.d? -1 : a.d>b.d? 1 : 0 ;});
      var match = distances[0].name;
      var style = (aStyle == "" || isNaN(aStyle))? (aStyle = " " + aStyle) : " translucent ";
      return style + " " + match.toLowerCase();
    }

    //////////////////////////////////////////////////////////////////////
    // RectangleImage: Number Number Mode Color -> Image
    var RectangleImage = function(width, height, style, color) {
        BaseImage.call(this);
        this.width  = width;
        this.height = height;
        this.style  = style;
        this.color  = color;
        this.vertices = [{x:0,y:height},{x:0,y:0},{x:width,y:0},{x:width,y:height}];
    };
    RectangleImage.prototype = heir(BaseImage.prototype);


    RectangleImage.prototype.getAriaText = function(depth) {
      return indefiniteArticle(colorToSpokenString(this.color,this.style)) +
        ((this.width===this.height)
         ? " square of size "+this.width
         : " rectangle of width "+this.width+" and height "+this.height);
    };

    //////////////////////////////////////////////////////////////////////
    // RhombusImage: Number Number Mode Color -> Image
    var RhombusImage = function(side, angle, style, color) {
        BaseImage.call(this);
        // sin(angle/2-in-radians) * side = half of base
        // cos(angle/2-in-radians) * side = half of height
        this.width  = Math.sin(angle/2 * Math.PI / 180) * side * 2;
        this.height = Math.abs(Math.cos(angle/2 * Math.PI / 180)) * side * 2;
        this.style  = style;
        this.color  = color;
        this.side   = side;
        this.angle  = angle;
        this.vertices = [{x:this.width/2, y:0},
                         {x:this.width,   y:this.height/2},
                         {x:this.width/2, y:this.height},
                         {x:0,            y:this.height/2}];
    };
    RhombusImage.prototype = heir(BaseImage.prototype);

    RhombusImage.prototype.getAriaText = function(depth) {
        return indefiniteArticle(colorToSpokenString(this.color,this.style)) + " rhombus of size "+this.side+" and angle "+this.angle;
    };

    //////////////////////////////////////////////////////////////////////
    // PosnImage: Vertices Mode Color -> Image
    //
    var PosnImage = function(vertices, style, color) {
        BaseImage.call(this);
        var vertices = vertices.map(function(v){
            return { x: jsnums.toFixnum(types.posnX(v)), y: jsnums.toFixnum(types.posnY(v)) };
        });
        console.log('vertices are', vertices);

        this.width      = findWidth(vertices);
        this.height     = findHeight(vertices);
        this.style      = style;
        this.color      = color;
        this.vertices   = translateVertices(vertices);
    };
    PosnImage.prototype = heir(BaseImage.prototype);

    PosnImage.prototype.getAriaText = function(depth) {
        return indefiniteArticle(colorToSpokenString(this.color,this.style)) + ", " + this.vertices.length + "-pointed polygon ";
    };

    //////////////////////////////////////////////////////////////////////
    // PolygonImage: Number Count Step Mode Color -> Image
    //
    // See http://www.algebra.com/algebra/homework/Polygons/Inscribed-and-circumscribed-polygons.lesson
    // the polygon is inscribed in a circle, whose radius is length/2sin(pi/count)
    // another circle is inscribed in the polygon, whose radius is length/2tan(pi/count)
    // rotate a 3/4 quarter turn plus half the angle length to keep bottom base level
    var PolygonImage = function(length, count, step, style, color, ariaOverride) {
        BaseImage.call(this);
        this.outerRadius = Math.round(length/(2*Math.sin(Math.PI/count)));
        this.innerRadius = Math.round(length/(2*Math.tan(Math.PI/count)));
        var adjust = (3*Math.PI/2)+Math.PI/count;
        
        // rotate around outer circle, storing x and y coordinates
        var radians = 0, vertices = [];
        for(var i = 0; i < count; i++) {
            radians = radians + (step*2*Math.PI/count);
            vertices.push({ x: Math.round(this.outerRadius*Math.cos(radians-adjust)),
                            y: Math.round(this.outerRadius*Math.sin(radians-adjust))});
        }
        
        this.width      = findWidth(vertices);
        this.height     = findHeight(vertices);
        this.length     = length;
        this.count      = count;
        this.style      = style;
        this.color      = color;
        this.vertices   = translateVertices(vertices);
        this.ariaOverride = ariaOverride;
    };
 
    PolygonImage.prototype = heir(BaseImage.prototype);

    PolygonImage.prototype.getAriaText = function(depth) {
      return indefiniteArticle(colorToSpokenString(this.color, this.style)) + 
            (this.ariaOverride? " " + this.ariaOverride + " of size " + this.length
                : ", " + this.count + " sided polygon with each side of length " + this.length);
    };
    
    //////////////////////////////////////////////////////////////////////
    // TextImage: String Number Color String String String String any/c Boolean -> Image
    var TextImage = function(str, size, color, face, family, style, weight, underline, outline) {
        BaseImage.call(this);
        str             = JSON.stringify(str) // show all escape chars
        this.str        = str.substring(1, str.length-1); // chop off quotes
        this.size       = size;   // 18
        this.color      = color;  // red
        this.face       = face;   // Gill Sans
        this.family     = family; // 'swiss
        this.outline    = outline || false;
        this.style      = (style === "slant")? "oblique" : style;  // Racket's "slant" -> CSS's "oblique"
        this.weight     = (weight=== "light")? "lighter" : weight; // Racket's "light" -> CSS's "lighter"
        this.underline  = underline;
 
        // NOTE: we *ignore* font-family, as it causes a number of font bugs due the browser inconsistencies
        // example: "bold italic 20px 'Times', sans-serif".
        // Default weight is "normal", face is "Arial"
        this.font = (this.style+" " +this.weight+" "+this.size+"px "+'"'+this.face+'", '+this.family);

        // We don't trust ctx.measureText, since (a) it's buggy and (b) it doesn't measure height
        // based off of the amazing work at http://mudcu.be/journal/2011/01/html5-typographic-metrics/#baselineCanvas
        // PENDING CANVAS V5 API: http://www.whatwg.org/specs/web-apps/current-work/#textmetrics
 
        // build a DOM node with the same styling as the canvas, then measure it
        var container = document.createElement("div"),
            parent    = document.createElement("span"),
            image     = document.createElement("img");// hack to get at CSS measuring properties
        parent.style.font = this.font;                // use the same font settings as the context
        image.width = 42; image.height = 1;           // we use a dataURL to reduce dependency on external image files
        image.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWM4MbPgPwAGzwLR05RbqwAAAABJRU5ErkJggg==";
        container.style.cssText = "position: absolute; top: 0px; left: 0px; zIndex=-1; white-space: pre;";
        parent.appendChild(document.createTextNode(this.str)); // show all escape chars
        parent.appendChild(image);
        container.appendChild(parent);
        document.body.appendChild(container);
        
        // getting (more accurate) css equivalent of ctx.measureText()
        image.style.display = "none";
        parent.style.display= "inline";
        this.alphaBaseline = 0;
        this.width       = parent.offsetWidth;
        this.height      = parent.offsetHeight;
        document.body.removeChild(container);       // clean up after ourselves
    };
    
    TextImage.prototype = heir(BaseImage.prototype);

    TextImage.prototype.getAriaText = function(depth) {
      return " a string "+this.str+", colored "+colorToSpokenString(this.color,'solid')+" of size "+ this.size;
    };

    TextImage.prototype.render = function(ctx, x, y) {
        ctx.save();
        ctx.textAlign   = 'left';
        ctx.textBaseline= 'top';
        ctx.font        = this.font;
 
        // if 'outline' is enabled, use strokeText. Otherwise use fillText
        ctx.fillStyle = this.outline? 'white' : colorString(this.color);
        ctx.fillText(this.str, x, y);
        if(this.outline){
          ctx.strokeStyle = colorString(this.color);
          ctx.strokeText(this.str, x, y);
        }
        if(this.underline){
            ctx.beginPath();
            ctx.moveTo(x, y+this.size);
            // we use this.size, as it is more accurate for underlining than this.height
            ctx.lineTo(x+this.width, y+this.size);
            ctx.closePath();
            ctx.strokeStyle = colorString(this.color);
            ctx.stroke();
        }
        ctx.restore();
    };

    TextImage.prototype.getBaseline = function() { return this.alphaBaseline; };

    TextImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof TextImage)        &&
                this.str        === other.str       &&
                this.size       === other.size      &&
                this.face       === other.face      &&
                this.family     === other.family    &&
                this.style      === other.style     &&
                this.weight     === other.weight    &&
                this.underline  === other.underline &&
                this.font       === other.font      &&
                types.isEqual(this.color, other.color, aUnionFind) )
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);

    };


    //////////////////////////////////////////////////////////////////////
    // StarImage: fixnum fixnum fixnum color -> image
    // Most of this code here adapted from the Canvas tutorial at:
    // http://developer.apple.com/safari/articles/makinggraphicswithcanvas.html
    var StarImage = function(points, outer, inner, style, color) {
        BaseImage.call(this);
        var maxRadius = Math.max(inner, outer);
        var vertices  = [];
 
        var oneDegreeAsRadian = Math.PI / 180;
        for(var pt = 0; pt < (points * 2) + 1; pt++ ) {
          var rads = ( ( 360 / (2 * points) ) * pt ) * oneDegreeAsRadian - 0.5;
          var whichRadius = ( pt % 2 === 1 ) ? outer : inner;
          vertices.push({x:maxRadius + ( Math.sin( rads ) * whichRadius ),
                         y:maxRadius + ( Math.cos( rads ) * whichRadius )} );
        }
        // calculate width and height of the bounding box
        this.width      = findWidth(vertices);
        this.height     = findHeight(vertices);
        this.style      = style;
        this.color      = color;
        this.points     = points;
        this.inner      = inner;
        this.outer      = outer;
        this.vertices   =   translateVertices(vertices);
    };
    StarImage.prototype = heir(BaseImage.prototype);

    StarImage.prototype.getAriaText = function(depth) {
         return indefiniteArticle(colorToSpokenString(this.color,this.style)) + ", " + this.points +
           "-pointed star with inner radius "+this.inner+" and outer radius "+this.outer;
       };

     /////////////////////////////////////////////////////////////////////
     //TriangleImage: Number Number Number Mode Color -> Image
     // Draws a triangle with the base = sideC, and the angle between sideC
     // and sideB being angleA
     // See http://docs.racket-lang.org/teachpack/2htdpimage.html#(def._((lib._2htdp/image..rkt)._triangle))
    var TriangleImage = function(sideC, angleA, sideB, style, color) {
        BaseImage.call(this);
        this.sideC = sideC;
        this.sideB = sideB;
        this.angleA = angleA;
        var thirdX = sideB * Math.cos(angleA * Math.PI/180);
        var thirdY = sideB * Math.sin(angleA * Math.PI/180);
        var offsetX = 0 - Math.min(0, thirdX); // angleA could be obtuse

        var vertices = [];
        // if angle < 180 start at the top of the canvas, otherwise start at the bottom
        if(thirdY > 0){
          vertices.push({x: offsetX + 0,        y: 0});
          vertices.push({x: offsetX + sideC,    y: 0});
          vertices.push({x: offsetX + thirdX,   y: thirdY});
        } else {
          vertices.push({x: offsetX + 0,        y: -thirdY});
          vertices.push({x: offsetX + sideC,    y: -thirdY});
          vertices.push({x: offsetX + thirdX,   y: 0});
        }
        
        this.width = Math.max(sideC, thirdX) + offsetX;
        this.height = Math.abs(thirdY);
        this.style = style;
        this.color = color;
        this.vertices = vertices;
    };
    TriangleImage.prototype = heir(BaseImage.prototype);

    TriangleImage.prototype.getAriaText = function(depth) {
        var ariaText = indefiniteArticle(colorToSpokenString(this.color,this.style));
        if(this.angleA === 270) {
            ariaText += " right triangle whose base is of length "+this.sideC+" and height of "+this.sideB;
        } else if(this.angleA === 300 && this.sideC === this.sideB) {
            ariaText += " equilateral triangle with sides of length "+this.sideC;
        } else {
            ariaText += " triangle whose base is of length "+this.sideC + ", with an angle of "
             + (this.angleA%180) + " degrees between it and a side of length "+this.sideB;
        }
        return ariaText;
    }

    //////////////////////////////////////////////////////////////////////
    //Ellipse : Number Number Mode Color -> Image
    var EllipseImage = function(width, height, style, color) {
        BaseImage.call(this);
        this.width = width;
        this.height = height;
        this.style = style;
        this.color = color;
    };

    EllipseImage.prototype = heir(BaseImage.prototype);

    EllipseImage.prototype.getAriaText = function(depth) {
        return indefiniteArticle(colorToSpokenString(this.color,this.style)) + 
            ((this.width===this.height)? " circle of radius "+(this.width/2) 
            : " ellipse of width "+this.width+" and height "+this.height);

    }

    EllipseImage.prototype.render = function(ctx, aX, aY) {
        ctx.save();
        ctx.beginPath();

        // if it's a solid ellipse...
        var isSolid = this.style.toString().toLowerCase() !== "outline";
        var adjust = isSolid? 0 : 0.5;
        // ...account for the 1px border width
        var width = this.width - 2*adjust, height = this.height - 2*adjust;
        aX += adjust; aY += adjust;

        // Most of this code is taken from:
        // http://webreflection.blogspot.com/2009/01/ellipse-and-circle-for-canvas-2d.html
        var hB = (width  / 2) * 0.5522848,
            vB = (height / 2) * 0.5522848,
            eX = aX + width ,
            eY = aY + height,
            mX = aX + width  / 2,
            mY = aY + height / 2;
        ctx.moveTo(aX, mY);
        ctx.bezierCurveTo(aX, mY - vB, mX - hB, aY, mX, aY);
        ctx.bezierCurveTo(mX + hB, aY, eX, mY - vB, eX, mY);
        ctx.bezierCurveTo(eX, mY + vB, mX + hB, eY, mX, eY);
        ctx.bezierCurveTo(mX - hB, eY, aX, mY + vB, aX, mY);
        ctx.closePath();
        if (this.style.toString().toLowerCase() === "outline") {
            ctx.strokeStyle = colorString(this.color);
            ctx.stroke();
        } else {
            ctx.fillStyle = colorString(this.color, this.style);
            ctx.fill();
        }

        ctx.restore();
    };

    EllipseImage.prototype.isEqual = function(other, aUnionFind) {
        return ((other instanceof EllipseImage)     &&
                this.width    === other.width       &&
                this.height   === other.height      &&
                this.style    === other.style       &&
                types.isEqual(this.color, other.color, aUnionFind))
            || BaseImage.prototype.isEqual.call(this, other, aUnionFind);
    };


    //////////////////////////////////////////////////////////////////////
    // Line: Number Number Color Boolean -> Image
    var LineImage = function(x, y, color) {
        BaseImage.call(this);
        var vertices;
        if (x >= 0) {
            if (y >= 0) { vertices = [{x:  0, y:  0}, {x: x, y: y}]; }
            else        { vertices = [{x:  0, y: -y}, {x: x, y: 0}]; }
        } else {
            if (y >= 0) { vertices = [{x: -x, y:  0}, {x: 0, y: y}]; }
            else        { vertices = [{x: -x, y: -y}, {x: 0, y: 0}]; }
        }
        this.x = x;
        this.y = y;
        this.width  = Math.abs(x);
        this.height = Math.abs(y);
        this.style  = "outline"; // all vertex-based images must have a style
        this.color  = color;
        this.vertices = vertices;
    };

    LineImage.prototype = heir(BaseImage.prototype);

    LineImage.prototype.getAriaText = function(depth) {
        return indefiniteArticle(colorToSpokenString(this.color,"")) + 
            " line of width "+this.x+" and height "+this.y;
    }

    //////////////////////////////////////////////////////////////////////
    // Effects

    /**
     * applyEffect: compound-effect -> (arrayof (world -> world))

     applyEffect applies all of the effects

     @param aCompEffect a compound effect is either a scheme list of
     compound effects or a single primitive effect */
    world.Kernel.applyEffect = function(aCompEffect) {
        if (aCompEffect === types.EMPTY) {
            // Do Nothing
        } else if ( types.isPair(aCompEffect) ) {
            var results = world.Kernel.applyEffect(aCompEffect.first);
            return results.concat(world.Kernel.applyEffect(aCompEffect.rest));
        } else {
            var newResult = aCompEffect.run();
            if (newResult) {
                return newResult;
            }
        }
        return [];
    };

    //////////////////////////////////////////////////////////////////////////
    // Color database
    var ColorDb = function() {
        this.colors = {};
    };
    ColorDb.prototype.put = function(name, color) {
        this.colors[name] = color;
    };

    // can be called with three types of value: (1) a string (colorname), (2) a color struct
    // or (3) a runtime string object with a hash and a toString method
    ColorDb.prototype.get = function(name) {
        if(name.toString) { // normalize if it's a string, or can be made into one
            return this.colors[name.toString().replace(/\s/g, "").toUpperCase()];
        }
    };


    // FIXME: update toString to handle the primitive field values.
    var colorDb = new ColorDb();
    colorDb.put("ORANGE", types.color(255, 165, 0, 255));
    colorDb.put("LIGHTORANGE", types.color(255, 216, 51, 255));
    colorDb.put("MEDIUMORANGE", types.color(255, 165, 0, 255));
    colorDb.put("ORANGERED", types.color(255, 69, 0, 255));
    colorDb.put("TOMATO", types.color(255, 99, 71, 255));
    colorDb.put("RED", types.color(255, 0, 0, 255));
    colorDb.put("LIGHTRED", types.color(255, 102, 102, 255));
    colorDb.put("MEDIUMRED", types.color(255, 0, 0, 255));
    colorDb.put("DARKRED", types.color(139, 0, 0, 255));
    colorDb.put("FIREBRICK", types.color(178, 34, 34, 255));
    colorDb.put("CRIMSON", types.color(220, 20, 60, 255));
    colorDb.put("DEEPPINK", types.color(255, 20, 147, 255));
    colorDb.put("MAROON", types.color(176, 48, 96, 255));
    colorDb.put("INDIANRED", types.color(205, 92, 92, 255));
    colorDb.put("MEDIUMVIOLETRED", types.color(199, 21, 133, 255));
    colorDb.put("VIOLETRED", types.color(208, 32, 144, 255));
    colorDb.put("LIGHTCORAL", types.color(240, 128, 128, 255));
    colorDb.put("HOTPINK", types.color(255, 105, 180, 255));
    colorDb.put("PALEVIOLETRED", types.color(219, 112, 147, 255));
    colorDb.put("LIGHTPINK", types.color(255, 182, 193, 255));
    colorDb.put("ROSYBROWN", types.color(188, 143, 143, 255));
    colorDb.put("PINK", types.color(255, 192, 203, 255));
    colorDb.put("MEDIUMPINK", types.color(255, 192, 203, 255));
    colorDb.put("DARKPINK", types.color(204, 141, 152, 255));
    colorDb.put("ORCHID", types.color(218, 112, 214, 255));
    colorDb.put("LAVENDERBLUSH", types.color(255, 240, 245, 255));
    colorDb.put("SNOW", types.color(255, 250, 250, 255));
    colorDb.put("CHOCOLATE", types.color(210, 105, 30, 255));
    colorDb.put("SADDLEBROWN", types.color(139, 69, 19, 255));
    colorDb.put("BROWN", types.color(132, 60, 36, 255));
    colorDb.put("LIGHTBROWN", types.color(183, 111, 87, 255));
    colorDb.put("MEDIUMBROWN", types.color(132, 60, 36, 255));
    colorDb.put("DARKBROWN", types.color(81, 9, 0, 255));
    colorDb.put("DARKORANGE", types.color(255, 140, 0, 255));
    colorDb.put("CORAL", types.color(255, 127, 80, 255));
    colorDb.put("SIENNA", types.color(160, 82, 45, 255));
    colorDb.put("ORANGE", types.color(255, 165, 0, 255));
    colorDb.put("SALMON", types.color(250, 128, 114, 255));
    colorDb.put("PERU", types.color(205, 133, 63, 255));
    colorDb.put("GOLDENROD", types.color(218, 165, 32, 255));
    colorDb.put("LIGHTGOLDENROD", types.color(255, 216, 83, 255));
    colorDb.put("DARKGOLDENROD", types.color(184, 134, 11, 255));
    colorDb.put("SANDYBROWN", types.color(244, 164, 96, 255));
    colorDb.put("LIGHTSALMON", types.color(255, 160, 122, 255));
    colorDb.put("DARKSALMON", types.color(233, 150, 122, 255));
    colorDb.put("GOLD", types.color(255, 215, 0, 255));
    colorDb.put("YELLOW", types.color(255, 255, 0, 255));
    colorDb.put("LIGHTYELLOW", types.color(255, 255, 51, 255));
    colorDb.put("MEDIUMYELLOW", types.color(255, 255, 0, 255));
    colorDb.put("DARKYELLOW", types.color(204, 204, 0, 255));
    colorDb.put("OLIVE", types.color(128, 128, 0, 255));
    colorDb.put("BURLYWOOD", types.color(222, 184, 135, 255));
    colorDb.put("TAN", types.color(210, 180, 140, 255));
    colorDb.put("NAVAJOWHITE", types.color(255, 222, 173, 255));
    colorDb.put("PEACHPUFF", types.color(255, 218, 185, 255));
    colorDb.put("KHAKI", types.color(240, 230, 140, 255));
    colorDb.put("DARKKHAKI", types.color(189, 183, 107, 255));
    colorDb.put("MOCCASIN", types.color(255, 228, 181, 255));
    colorDb.put("WHEAT", types.color(245, 222, 179, 255));
    colorDb.put("BISQUE", types.color(255, 228, 196, 255));
    colorDb.put("PALEGOLDENROD", types.color(238, 232, 170, 255));
    colorDb.put("BLANCHEDALMOND", types.color(255, 235, 205, 255));
    colorDb.put("MEDIUMGOLDENROD", types.color(234, 234, 173, 255));
    colorDb.put("PAPAYAWHIP", types.color(255, 239, 213, 255));
    colorDb.put("MISTYROSE", types.color(255, 228, 225, 255));
    colorDb.put("LEMONCHIFFON", types.color(255, 250, 205, 255));
    colorDb.put("ANTIQUEWHITE", types.color(250, 235, 215, 255));
    colorDb.put("CORNSILK", types.color(255, 248, 220, 255));
    colorDb.put("LIGHTGOLDENRODYELLOW", types.color(250, 250, 210, 255));
    colorDb.put("OLDLACE", types.color(253, 245, 230, 255));
    colorDb.put("LINEN", types.color(250, 240, 230, 255));
    colorDb.put("LIGHTYELLOW", types.color(255, 255, 224, 255));
    colorDb.put("SEASHELL", types.color(255, 245, 238, 255));
    colorDb.put("BEIGE", types.color(245, 245, 220, 255));
    colorDb.put("FLORALWHITE", types.color(255, 250, 240, 255));
    colorDb.put("IVORY", types.color(255, 255, 240, 255));
    colorDb.put("GREEN", types.color(0, 255, 0, 255));
    colorDb.put("MEDIUMGREEN", types.color(0, 255, 0, 255));
    colorDb.put("LAWNGREEN", types.color(124, 252, 0, 255));
    colorDb.put("CHARTREUSE", types.color(127, 255, 0, 255));
    colorDb.put("GREENYELLOW", types.color(173, 255, 47, 255));
    colorDb.put("YELLOWGREEN", types.color(154, 205, 50, 255));
    colorDb.put("OLIVEDRAB", types.color(107, 142, 35, 255));
    colorDb.put("MEDIUMFORESTGREEN", types.color(107, 142, 35, 255));
    colorDb.put("DARKOLIVEGREEN", types.color(85, 107, 47, 255));
    colorDb.put("DARKSEAGREEN", types.color(143, 188, 139, 255));
    colorDb.put("LIME", types.color(0, 255, 0, 255));
    colorDb.put("DARKGREEN", types.color(0, 100, 0, 255));
    colorDb.put("LIMEGREEN", types.color(50, 205, 50, 255));
    colorDb.put("FORESTGREEN", types.color(34, 139, 34, 255));
    colorDb.put("SPRING GREEN", types.color(0, 255, 127, 255));
    colorDb.put("SPRINGGREEN", types.color(0, 255, 127, 255));
    colorDb.put("MEDIUMSPRINGGREEN", types.color(0, 250, 154, 255));
    colorDb.put("SEAGREEN", types.color(46, 139, 87, 255));
    colorDb.put("MEDIUMSEAGREEN", types.color(60, 179, 113, 255));
    colorDb.put("AQUAMARINE", types.color(112, 216, 144, 255));
    colorDb.put("LIGHTGREEN", types.color(144, 238, 144, 255));
    colorDb.put("PALEGREEN", types.color(152, 251, 152, 255));
    colorDb.put("MEDIUM AQUAMARINE", types.color(102, 205, 170, 255));
    colorDb.put("MEDIUMAQUAMARINE", types.color(102, 205, 170, 255));
    colorDb.put("TURQUOISE", types.color(64, 224, 208, 255));
    colorDb.put("LIGHTTURQUOISE", types.color(155, 255, 255, 255));
    colorDb.put("MEDIUMTURQUOISE", types.color(72, 209, 204, 255));
    colorDb.put("LIGHTSEAGREEN", types.color(32, 178, 170, 255));
    colorDb.put("HONEYDEW", types.color(240, 255, 240, 255));
    colorDb.put("MINTCREAM", types.color(245, 255, 250, 255));
    colorDb.put("ROYALBLUE", types.color(65, 105, 225, 255));
    colorDb.put("DODGERBLUE", types.color(30, 144, 255, 255));
    colorDb.put("DEEPSKYBLUE", types.color(0, 191, 255, 255));
    colorDb.put("CORNFLOWERBLUE", types.color(100, 149, 237, 255));
    colorDb.put("STEELBLUE", types.color(70, 130, 180, 255));
    colorDb.put("LIGHTSKYBLUE", types.color(135, 206, 250, 255));
    colorDb.put("DARKTURQUOISE", types.color(0, 206, 209, 255));
    colorDb.put("CYAN", types.color(0, 255, 255, 255));
    colorDb.put("LIGHTCYAN", types.color(224, 255, 255, 255));
    colorDb.put("MEDIUMCYAN", types.color(0, 255, 255, 255));
    colorDb.put("DARKCYAN", types.color(0, 139, 139, 255));
    colorDb.put("AQUA", types.color(0, 255, 255, 255));
    colorDb.put("TEAL", types.color(0, 128, 128, 255));
    colorDb.put("SKYBLUE", types.color(135, 206, 235, 255));
    colorDb.put("CADETBLUE", types.color(95, 158, 160, 255));
    colorDb.put("DARKSLATEGRAY", types.color(47, 79, 79, 255));
    colorDb.put("LIGHTSLATEGRAY", types.color(119, 136, 153, 255));
    colorDb.put("SLATEGRAY", types.color(112, 128, 144, 255));
    colorDb.put("LIGHTSTEELBLUE", types.color(176, 196, 222, 255));
    colorDb.put("LIGHTBLUE", types.color(173, 216, 230, 255));
    colorDb.put("POWDERBLUE", types.color(176, 224, 230, 255));
    colorDb.put("PALETURQUOISE", types.color(175, 238, 238, 255));
    colorDb.put("ALICEBLUE", types.color(240, 248, 255, 255));
    colorDb.put("AZURE", types.color(240, 255, 255, 255));
    colorDb.put("MEDIUMBLUE", types.color(0, 0, 205, 255));
    colorDb.put("DARKBLUE", types.color(0, 0, 139, 255));
    colorDb.put("MIDNIGHTBLUE", types.color(25, 25, 112, 255));
    colorDb.put("NAVY", types.color(36, 36, 140, 255));
    colorDb.put("BLUE", types.color(0, 0, 255, 255));
    colorDb.put("INDIGO", types.color(75, 0, 130, 255));
    colorDb.put("BLUEVIOLET", types.color(138, 43, 226, 255));
    colorDb.put("MEDIUMSLATEBLUE", types.color(123, 104, 238, 255));
    colorDb.put("SLATEBLUE", types.color(106, 90, 205, 255));
    colorDb.put("PURPLE", types.color(160, 32, 240, 255));
    colorDb.put("LIGHTPURPLE", types.color(211, 83, 255, 255));
    colorDb.put("MEDIUMPURPLE", types.color(147, 112, 219, 255));
    colorDb.put("DARKPURPLE", types.color(109, 0, 189, 255));
    colorDb.put("DARKSLATEBLUE", types.color(72, 61, 139, 255));
    colorDb.put("DARKVIOLET", types.color(148, 0, 211, 255));
    colorDb.put("DARKORCHID", types.color(153, 50, 204, 255));
    colorDb.put("MEDIUMORCHID", types.color(186, 85, 211, 255));
    colorDb.put("MAGENTA", types.color(255, 0, 255, 255));
    colorDb.put("FUCHSIA", types.color(255, 0, 255, 255));
    colorDb.put("DARKMAGENTA", types.color(139, 0, 139, 255));
    colorDb.put("VIOLET", types.color(238, 130, 238, 255));
    colorDb.put("PLUM", types.color(221, 160, 221, 255));
    colorDb.put("LAVENDER", types.color(230, 230, 250, 255));
    colorDb.put("THISTLE", types.color(216, 191, 216, 255));
    colorDb.put("GHOSTWHITE", types.color(248, 248, 255, 255));
    colorDb.put("WHITE", types.color(255, 255, 255, 255));
    colorDb.put("WHITESMOKE", types.color(245, 245, 245, 255));
    colorDb.put("GAINSBORO", types.color(220, 220, 220, 255));
    colorDb.put("LIGHTGRAY", types.color(211, 211, 211, 255));
    colorDb.put("LIGHTGREY", types.color(211, 211, 211, 255));
    colorDb.put("SILVER", types.color(192, 192, 192, 255));
    colorDb.put("GRAY", types.color(190, 190, 190, 255));
    colorDb.put("GREY", types.color(190, 190, 190, 255));
    colorDb.put("MEDIUMGRAY", types.color(190, 190, 190, 255));
    colorDb.put("MEDIUMGREY", types.color(190, 190, 190, 255));
    colorDb.put("DARKGRAY", types.color(169, 169, 169, 255));
    colorDb.put("DARKGREY", types.color(169, 169, 169, 255));
    colorDb.put("DIMGRAY", types.color(105, 105, 105, 255));
    colorDb.put("DIMGREY", types.color(105, 105, 105, 255));
    colorDb.put("BLACK", types.color(0, 0, 0, 255));
    colorDb.put("TRANSPARENT", types.color(0, 0, 0, 0));

    var nameToColor = function(s) {
         return colorDb.get('' + s);
    };
 
    // based on answer provided at
    // http://stackoverflow.com/questions/15408522/rgb-to-xyz-and-lab-colours-conversion
    function RGBtoLAB(r, g, b){
      function RGBtoXYZ(r, g, b){
         function process(v){
           v = parseFloat(v/255);
           return (v>0.04045? Math.pow( (v+0.055)/1.055, 2.4) : v/12.92) * 100;
         }
        var var_R = process(r), var_G = process(g), var_B = process(b);
        //Observer. = 2°, Illuminant = D65
        var X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
        var Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
        var Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;
        return [X, Y, Z];
      }
      
      function XYZtoLAB(x, y, z){
        var var_X = x / 95.047;           //ref_X =  95.047   Observer= 2°, Illuminant= D65
        var var_Y = y / 100.000;          //ref_Y = 100.000
        var var_Z = z / 108.883;          //ref_Z = 108.883
        function process(v){ return v>0.008856? Math.pow(v, 1/3) : (7.787*v) + (16/116); }
        var_X = process(var_X); var_Y = process(var_Y); var_Z = process(var_Z);
        var CIE_L = ( 116 * var_Y ) - 16;
        var CIE_a = 500 * ( var_X - var_Y );
        var CIE_b = 200 * ( var_Y - var_Z );
        return [CIE_L, CIE_a, CIE_b];
      }
      var xyz = RGBtoXYZ(r,g,b), lab = XYZtoLAB(xyz[0],xyz[1],xyz[2]);
      return {l: lab[0], a: lab[1], b:lab[2]};
    }
    var colorLabs = [], colorRgbs = colorDb.colors;
    for (var p in colorRgbs) {
      if (colorRgbs.hasOwnProperty(p)) {
        var lab = RGBtoLAB(types.colorRed(colorRgbs[p]),
                           types.colorGreen(colorRgbs[p]),
                           types.colorBlue(colorRgbs[p]));
        colorLabs.push({name:p, l:lab.l, a:lab.a, b:lab.b});
      }
    }

    ///////////////////////////////////////////////////////////////
    // Exports

    world.Kernel.isImage = isImage;
    world.Kernel.isScene = isScene;
    world.Kernel.isColor = function(thing) {
        return (types.isColor(thing) ||
                ((types.isString(thing) || types.isSymbol(thing)) &&
                 typeof(colorDb.get(thing)) !== 'undefined'));
    };
    world.Kernel.nameToColor = nameToColor;
    world.Kernel.colorDb = colorDb;
    world.Kernel.colorLabs = colorLabs;
 
    world.Kernel.sceneImage = function(width, height, children, withBorder, color) {
        return new SceneImage(width, height, children, withBorder, color);
    };
    world.Kernel.circleImage = function(radius, style, color) {
        return new EllipseImage(2*radius, 2*radius, style, color);
    };
    world.Kernel.starImage = function(points, outer, inner, style, color) {
        return new StarImage(points, outer, inner, style, color);
    };
    world.Kernel.rectangleImage = function(width, height, style, color) {
        return new RectangleImage(width, height, style, color);
    };
    world.Kernel.rhombusImage = function(side, angle, style, color) {
        return new RhombusImage(side, angle, style, color);
    };
    world.Kernel.polygonImage = function(length, count, step, style, color, ariaOverride) {
        return new PolygonImage(length, count, step, style, color, ariaOverride);
    };
    world.Kernel.posnImage = function(posns, style, color) {
        return new PosnImage(posns, style, color);
    };
    world.Kernel.squareImage = function(length, style, color) {
        return new RectangleImage(length, length, style, color);
    };
    world.Kernel.triangleImage = function(side, angle, side2, style, color) {
        return new TriangleImage(side, angle, side2, style, color);
    };
    world.Kernel.ellipseImage = function(width, height, style, color) {
        return new EllipseImage(width, height, style, color);
    };
    world.Kernel.lineImage = function(x, y, color) {
        return new LineImage(x, y, color);
    };
    world.Kernel.overlayImage = function(img1, img2, X, Y) {
        return new OverlayImage(img1, img2, X, Y);
    };
    world.Kernel.rotateImage = function(angle, img) {
        return new RotateImage(angle, img);
    };
    world.Kernel.scaleImage = function(xFactor, yFactor, img) {
        return new ScaleImage(xFactor, yFactor, img);
    };
    world.Kernel.cropImage = function(x, y, width, height, img) {
        return new CropImage(x, y, width, height, img);
    };
    world.Kernel.frameImage = function(img) {
        return new FrameImage(img);
    };
    world.Kernel.flipImage = function(img, direction) {
        return new FlipImage(img, direction);
    };
    world.Kernel.textImage = function(str, size, color, face, family, style, weight, underline, outline) {
        return new TextImage(str, size, color, face, family, style, weight, underline, outline);
    };
    world.Kernel.fileImage = function(path, rawImage, afterInit) {
        return FileImage.makeInstance(path, rawImage, afterInit);
    };
    world.Kernel.fileVideo = function(path, rawVideo) {
        return FileVideo.makeInstance(path, rawVideo);
    };
    world.Kernel.fileAudio = function(path, loop, rawAudio) {
        return FileAudio.makeInstance(path, loop, rawAudio);
    };

    world.Kernel.isSceneImage   = function(x) { return x instanceof SceneImage; };
    world.Kernel.isStarImage    = function(x) { return x instanceof StarImage; };
    world.Kernel.isRectangleImage=function(x) { return x instanceof RectangleImage; };
    world.Kernel.isPolygonImage = function(x) { return x instanceof PolygonImage; };
    world.Kernel.isRhombusImage = function(x) { return x instanceof RhombusImage; };
    world.Kernel.isTriangleImage= function(x) { return x instanceof TriangleImage; };
    world.Kernel.isEllipseImage = function(x) { return x instanceof EllipseImage; };
    world.Kernel.isLineImage    = function(x) { return x instanceof LineImage; };
    world.Kernel.isOverlayImage = function(x) { return x instanceof OverlayImage; };
    world.Kernel.isRotateImage  = function(x) { return x instanceof RotateImage; };
    world.Kernel.isScaleImage   = function(x) { return x instanceof ScaleImage; };
    world.Kernel.isCropImage    = function(x) { return x instanceof CropImage; };
    world.Kernel.isFrameImage   = function(x) { return x instanceof FrameImage; };
    world.Kernel.isFlipImage    = function(x) { return x instanceof FlipImage; };
    world.Kernel.isTextImage    = function(x) { return x instanceof TextImage; };
    world.Kernel.isFileImage    = function(x) { return x instanceof FileImage; };
    world.Kernel.isFileVideo    = function(x) { return x instanceof FileVideo; };

})();
