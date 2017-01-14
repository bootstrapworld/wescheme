package org.wescheme.project;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

import javax.jdo.PersistenceManager;
import javax.jdo.annotations.IdGeneratorStrategy;
import javax.jdo.annotations.PersistenceCapable;
import javax.jdo.annotations.Persistent;
import javax.jdo.annotations.IdentityType;
import javax.jdo.annotations.PrimaryKey;

import org.json.simple.JSONObject;
import org.json.simple.JSONArray;

import org.jdom.Element;
import org.wescheme.util.CacheHelpers;
import org.wescheme.util.Queries;
import org.wescheme.util.XML;

import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.KeyFactory;
import com.google.appengine.api.datastore.Text;


@PersistenceCapable(identityType = IdentityType.APPLICATION)
public class Program implements Serializable {

	static Logger logger = Logger.getLogger(Program.class.getName());

	/**
	 * 
	 */
	private static final long serialVersionUID = -8015242443391096978L;

	@PrimaryKey
	@Persistent(valueStrategy = IdGeneratorStrategy.IDENTITY)
	protected Long id;

	@Persistent
	protected String publicId_;

	@Persistent
	protected String title_;
        
        // TODO: Will this affect the PersistenceManager's treatment of other fields?
	// @Persistent
	// protected ObjectCode obj_;
	
	@Persistent
	protected Boolean isSourcePublic;
	
	@Persistent
	protected Boolean isDeleted;


	// Kludge: haven't figured out how to get JDO to update an existing
	// child element in a one-to-one relationship.
	@Persistent
	protected List<SourceCode> srcs_;
	@Persistent
	protected String owner_;
	@Persistent
	protected String author_;
	@Persistent
	protected long time_;
	@Persistent
	private boolean published_ = false;



	@Persistent
	private Long backlink_;

	@Persistent
	private Long mostRecentShare_;

	@Persistent
	private Text notes;
	

	private void updateTime(){
		time_ = System.currentTimeMillis();
		this.markOwnerCacheDirty();
	}

	
	public Program(String src, String ownerName){
		this.title_ = "Unknown";
		this.srcs_ = new ArrayList<SourceCode>();
		this.srcs_.add(new SourceCode(this.title_, src));
		this.isSourcePublic = false;
		this.isDeleted = false;
		this.owner_ 	= ownerName;
		this.author_ = owner_;
		this.backlink_ = null;
		this.mostRecentShare_ = null;
		this.updateTime();
	}


	// markOwnerProgramCacheDirty
	private void markOwnerCacheDirty() {
		if (this.owner_ != null)
			CacheHelpers.notifyUserProgramsDirtied(this.owner_);
	}
	
	
	// Creates a copy of the program owned by the user with the given ownerName.
	// Authorship is preserved, and we keep track of how the program was shared.
	public Program clone(String ownerName, PersistenceManager pm){
		Program p = new Program(this.getSource().toString(), ownerName);
		p.title_ = this.getTitle();
		p.backlink_ = this.getId();
		p.author_ = this.author_;
                p.notes = this.notes;
		p.updateTime();

		p = pm.makePersistent(p);
		this.setMostRecentShare(p.getId());
		return p;
	}


	public void share(boolean isObjectCodePublic){		
		published_ = true;
		this.isSourcePublic = isObjectCodePublic;
		updateTime();
	}

	public boolean getIsSourcePublic() {	
		if (this.isSourcePublic == null) {
			return false;
		}
		return this.isSourcePublic;
	}


	public boolean getIsDeleted() {
		if (this.isDeleted == null) {
			return false;
		} 
		return this.isDeleted.booleanValue();
	}

	public void setIsDeleted(boolean v) {
		this.isDeleted = v;
		updateTime();
	}

	public void unpublish(){
		published_ = false;
		updateTime();
	}

	public void updateTitle(String newTitle) {
		title_ = newTitle;
		updateTime();
	}

	public void updateSource(String src){
		this.setSource(new SourceCode(this.title_, src));
		updateTime();
	}

	public SourceCode getSource(){
		// Defensive: it should not be possible for this.srcs_ to
		// be null or the empty list, but I'm seeing these
		// from JDO.  Argh.
		if (this.srcs_ == null) {
			this.srcs_ = new ArrayList<SourceCode>();
		}
		if (this.srcs_.size() == 0) {
			this.srcs_.add(new SourceCode(this.title_, ""));
		}

        // Return the very last source.  
		return this.srcs_.get(this.srcs_.size() - 1);
	}

	private void setSource(SourceCode src) {
		this.srcs_.clear();
		this.srcs_.add(src);
		this.updateTime();
	}


	public String getOwner(){
		return owner_;
	}

	public Long getId(){
		return id;
	}

	public Long getBacklink() {
		return this.backlink_;
	}

	public Long getTime(){
		return time_;
	}

	public String getPublicId() {
		return this.publicId_;
	}

	public void setPublicId(String id) {
		this.publicId_ = id;
		this.updateTime();
	}

	public Long getMostRecentShare() {
		return this.mostRecentShare_;
	}

	public void setMostRecentShare(Long id) {
		logger.info("setMostRecentShare: " + this.id.toString() + " now points to " + id.toString());
		this.mostRecentShare_ = id;
		this.markOwnerCacheDirty();
	}

	private Program getMostRecentShareAsProgram(PersistenceManager pm) {
		logger.info("getMostRecentShareAsProgram: this.mostRecentShare_ == " + this.mostRecentShare_.toString());
		Key k = KeyFactory.createKey("Program", this.mostRecentShare_);
		Program prog = pm.getObjectById(Program.class, k);
		return prog;
	}

	public Element toXML(PersistenceManager pm) { return this.toXML(true, pm); }

	public Element toXML(boolean includeSource, PersistenceManager pm) {
		Element root = new Element("Program");
		if (includeSource) {
			root.addContent(getSource().toXML());
		}

		root.addContent(XML.makeElement("id", id));
		if (publicId_ != null) { root.addContent(XML.makeElement("publicId", publicId_)); }
		root.addContent(XML.makeElement("isSourcePublic", this.getIsSourcePublic()));
		root.addContent(XML.makeElement("title", getTitle()));
		root.addContent(XML.makeElement("owner", owner_));
		root.addContent(XML.makeElement("author", author_));
		root.addContent(XML.makeElement("modified", time_));
		root.addContent(XML.makeElement("published", published_));
		root.addContent(XML.makeElement("notes", this.getNotes()));
		
		Element sharedAsElt = new Element("sharedAs");
		for(Program p : this.getBacklinkedPrograms(pm)) {
			if (p.getPublicId() != null) {
				Element shared = new Element("Entry");
				shared.addContent(XML.makeElement("publicId", p.getPublicId()));
				shared.addContent(XML.makeElement("title", p.getTitle()));
				shared.addContent(XML.makeElement("modified", p.getTime()));
				sharedAsElt.addContent(shared);
			}
		}
		root.addContent(sharedAsElt);

		return root;
	}


    public JSONObject toJSON(PersistenceManager pm) { return this.toJSON(true, pm); }
    public JSONObject toJSON(boolean includeSource, PersistenceManager pm) {
        JSONObject json = new JSONObject();
        if (includeSource) { json.put("source", getSource().toJSON()); }
        json.put("id", id);
        if (publicId_ != null) { json.put("publicId", publicId_); }
        json.put("isSourcePublic", this.getIsSourcePublic());
        json.put("title", this.getTitle());
        json.put("owner", this.owner_);
        json.put("author", this.author_);
        json.put("modified", this.time_);
        json.put("published", this.published_);
        json.put("notes", this.getNotes());
        JSONArray sharedAs = new JSONArray();
        for(Program p : this.getBacklinkedPrograms(pm)) {
            if (p.getPublicId() != null) {
                JSONObject shared = new JSONObject();
                shared.put("publicId", p.getPublicId());
                shared.put("title", p.getTitle());
                shared.put("modified", p.getTime());
                sharedAs.add(shared);
            }
        }
        json.put("sharedAs", sharedAs);

        // TODO: Can this be removed?
        JSONArray permissions = new JSONArray();
        json.put("permissions", permissions);

        // TODO: Can this be removed?
        JSONArray provides = new JSONArray();
        json.put("provides", provides);

        return json;
    }


	public boolean isPublished() {

		return published_;
	}

	public String getTitle() {
		if (title_ == null) { return "null"; }
		return title_;
	}

	public String getAuthor() {
		return author_;
	}

	public void setAuthor(String author) {
		author_ = author;
		this.updateTime();
	}


	public String getNotes() {
            if (this.notes == null) {
                return "";
            }
            return this.notes.getValue();
	}
	
    /** Sets the notes for the program, and touches the timestamp.
     **/
    public void updateNotes(String n) {
        this.notes = new Text(n);
        this.updateTime();
    }
	


	/**
	 * Returns a list of the programs for which this has been backlinked, 
	 * sorted by modified date in descending order.
	 * @param pm
	 * @return
	 */
	public List<Program> getBacklinkedPrograms(PersistenceManager pm) {
		List<Program> pl;
		if (this.mostRecentShare_ == null) {
			pl = Queries.getBacklinkedPrograms(pm, this.id);
			if (pl.size() > 0) {
				Program mostRecentShare = pl.get(0);
				this.setMostRecentShare(mostRecentShare.getId());
			}
		} else {
			pl = new ArrayList<Program>();
			Program mostRecentShare = this.getMostRecentShareAsProgram(pm);
			pl.add(0, mostRecentShare);
		}
		return pl;
	}
}
