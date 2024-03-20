// console.js provides the functionality for the console: listing
// current projects, deleting and sharing projects.
goog.require('plt.wescheme.AjaxActions');
goog.require('plt.wescheme.SharingDialog');
goog.require('plt.wescheme.DeleteDialog');
goog.require("plt.wescheme.ProgramDigest");
goog.require("plt.wescheme.helpers");
goog.require("plt.wescheme.browserCheck");

// loadProgramList: (-> void) -> void
// Load up the program list and fill the document with it.
// Calls the continuation if the load is successful.
var loadProgramList = function(k) {
    var actions = new plt.wescheme.AjaxActions();

    actions.listProjects(
	// On successful project list loading, load the list
	function(dom) {
	    var programListTable = clearConsoleListing();	
	    dom.find("ProgramDigest").each(function() {	
			var digest = jQuery(this);
			if (digest.children("published").text() == 'true') {
			    // skip it
			} else {
			    addProgramEntry(digest, 
					    		new plt.wescheme.ProgramDigest(digest),
					    		programListTable);
			}
	    });
	    if (typeof(k) === 'function') { k(); }
	},
        
	// Otherwise, fail by raising an alert.
	function() {
	    alert("Could not load list of projects")
	});
}

// clearConsoleListing: -> table
// clears the contents of the console list, returning a fresh
// ul entry where things can be appended.
var clearConsoleListing = function() {
    var programListDiv = document.getElementById("programList");
    // remove the table
    programListDiv.removeChild(programListDiv.firstChild); 
    // rebuild the table, add the header, and return a pointer to it
    var programListTable = document.createElement("table");
    programListTable.innerHTML = "<tr class='EntryHeader'>"
    	+ "<td class='ProgramTitle'><span>Program Title</span></td>"
    	+ "<td class='ProgramModified'>Last Modified (D/M/YYYY)</td>"
    	+ "<td class='ProgramPublished'>Share</td><td class='ProgramDelete'>Delete</td>"
    	+ "<td class='spacer'></td></tr>";
    programListDiv.appendChild(programListTable);
    return programListTable.firstChild;
}

var addProgramEntry = function(digest, aProgramDigest, programListTable) {
    var row = document.createElement("tr");
    row.className = "ProgramEntry";
    // Program Name
    var name = document.createElement("td");
    var span = document.createElement("span");
    var id = aProgramDigest.getId();
    name.className = "ProgramTitle";
    var link = document.createElement("a");
    link.href = "/openEditor?pid="+id;
    link.target = "_editor" + id;
    link.innerHTML = aProgramDigest.getTitle() || "(No name)";
    span.appendChild(link);
    name.appendChild(span);
    // Last Modified
	var modified = document.createElement("td");
	modified.className = "ProgramModified";
	modified.innerHTML = plt.wescheme.helpers.prettyPrintDate(aProgramDigest.getModified());
    // Share
    var shareTD = document.createElement("td");
    var shareSpan = plt.wescheme.SharingDialog.makeShareButton(aProgramDigest, loadProgramList);
    shareTD.className = "ProgramPublished";
    shareTD.appendChild(shareSpan[0]);
    // Delete
    var deleteTD = document.createElement("td");
    var deleteSpan = plt.wescheme.DeleteDialog.makeDeleteButton(
						aProgramDigest, loadProgramList, loadProgramList);
    deleteTD.className = "ProgramDelete";
    deleteTD.appendChild(deleteSpan[0]);
    // Spacer
    var spacer = document.createElement("td");
    // add TDs for name, modified, share and delete
    row.appendChild(name);
    row.appendChild(modified);
    row.appendChild(shareTD);
    row.appendChild(deleteTD);
    row.appendChild(spacer);
    programListTable.appendChild(row);
};

jQuery(document).ready(function() {
    plt.wescheme.browserCheck();
    loadProgramList(function() {});

    $('#logoutForm').bind(
        "submit",
        function(e) {
            if(!(confirm("You will be logged out of WeScheme and other Google services."))) {
                e.stopPropagation();
                e.preventDefault();
            }
        });
});