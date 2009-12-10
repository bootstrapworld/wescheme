goog.require("plt.wescheme.SharedAs");


goog.provide("plt.wescheme.ProgramDigest");

// Abstraction around ProgramDigest XML objects


(function() {

    plt.wescheme.ProgramDigest = function(dom) {
	this.dom = dom;
    };


    plt.wescheme.ProgramDigest.prototype.getTitle = function() {
	return this.dom.children("title").text();
    };


    plt.wescheme.ProgramDigest.prototype.getId = function() {
	return this.dom.children("id").text();
    };


    plt.wescheme.ProgramDigest.prototype.getModified = function() {
	return this.dom.children("modified").text();
    };


    plt.wescheme.ProgramDigest.prototype.hasSharingUrls = function() {
	return this.dom.find('sharedAs Entry').length > 0;
    };


    // getSharedAsEntries: -> [{publicId: string, title: string, modified: string} ...]
    plt.wescheme.ProgramDigest.prototype.getSharedAsEntries = function() {
	return new plt.wescheme.SharedAs(
	    this.dom.children('sharedAs')).getEntries();
    };


    plt.wescheme.ProgramDigest.prototype.isPublished = function() {
	return this.dom.children("published").text() == 'true'
    };


}());