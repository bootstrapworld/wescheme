goog.require('goog.ui.Container');
goog.require('goog.style');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.ui.SplitPane');
goog.require('goog.ui.SplitPane.Orientation');





var onLoad = function() {
    var splitpane1 = new goog.ui.SplitPane(
	new goog.ui.Component(),
	new goog.ui.Component(),
        goog.ui.SplitPane.Orientation.VERTICAL);
    
    splitpane1.decorate(document.getElementById('aSplitter'));


    var vsm = new goog.dom.ViewportSizeMonitor();
    var getSize = function() {
        return goog.style.getBorderBoxSize(
            document.getElementById('aSplitterWrapper'));
    };

    var currentSize = getSize();

    var onResize = function(e) {
	var newSize = getSize();
	if (! goog.math.Size.equals(currentSize, newSize)) {
            currentSize = newSize;
            splitpane1.setSize(newSize);
	}
	synchronizeTopSize();
    };

    var synchronizeTopSize = function() {
	goog.style.setBorderBoxSize(
	    document.getElementById("aTextarea"),
	    goog.style.getBorderBoxSize(
		document.getElementById("top")));
    };


    synchronizeTopSize();



    goog.events.listen(splitpane1,
		       goog.events.EventType.CHANGE,
		       synchronizeTopSize);

    goog.events.listen(document.getElementById('aSplitterWrapper'),
                       goog.events.EventType.RESIZE,
                       onResize);
    goog.events.listen(vsm,
                       goog.events.EventType.RESIZE,
                       onResize);
};