from google.cloud import datastore
import xml.etree.ElementTree as ET

from util import *

class Program:
    def __init__(
        self, key=None, title=None, author=None, owner=None,
        backlink=None, mostRecentShare=None, notes=None,
        mod_time=None, publicId=None,
        published=False, isDeleted=False, isSourcePublic=False,
    ):
        self.key = client.key('Program') if (key is None) else key
        self.title = title
        self.author = session['fname'] if (author is None) else author
        self.owner = session['fname'] if (owner is None) else owner
        self.backlink = backlink
        self.mostRecentShare = mostRecentShare
        self.notes = notes
        self.mod_time = epoch_time() if (mod_time is None) else mod_time
        self.publicId = Program.gen_publicId() if (publicId is None) else publicId

        self.isDeleted = isDeleted
        self.isSourcePublic = isSourcePublic
        self.published = published
    
    def from_id(pid):
        '''
        Pull Program stored in database with the given id
        '''
        prog_key = client.key('Program', pid)
        prog = client.get(prog_key)
        return Program.from_entity(prog)

    def from_publicId(publicId):
        '''
        Pull Program stored in database with given publicId, which we also maintain as
        unique even though it isn't officially the primary key.
        '''
        pub_q = client.query(kind='Program')
        pub_q.add_filter('publicId_', '=', publicId)

        prog = list(pub_q.fetch())[0]
        return Program.from_entity(prog)

    def gen_publicId():
        '''
        Randomly generate a string to use as publicId until
        we find one that hasn't been used before (should very very rarely loop)
        '''
        while True:
            publicId = "".join(random.choices(BASE_62_CHARS, k=KEY_LENGTH))
            query = client.query(kind='Program')
            query.add_filter('publicId_', '=', publicId)
            progs = list(query.fetch(limit=1))
            if len(progs) == 0: return publicId

    def from_entity(ent):
        x = dict(ent)
        return Program(
            key=ent.key,
            title=ent.get('title_'),
            author=ent.get('author_'),
            owner=ent.get('owner_'),
            backlink=ent.get('backlink_'),
            isDeleted=ent.get('isDeleted'),
            isSourcePublic=ent.get('isSourcePublic'),
            mostRecentShare=ent.get('mostRecentShare_'),
            notes=ent.get('notes'),
            published=ent.get('published_'),
            mod_time=ent.get('time_'),
            publicId=ent.get('publicId_'))

    def get_backlinked_progs(self):
        # TODO: handle this err: if self.key.id is None: return []
        back_q = client.query(kind='Program')
        back_q.add_filter('backlink_', '=', self.key.id)
        return list(map(lambda x: Program.from_entity(x), list(back_q.fetch())))

    def to_entity(self):
        ent = datastore.Entity(self.key, exclude_from_indexes=('notes',))
        if self.title is not None: ent['title_'] = self.title
        if self.author is not None: ent['author_'] = self.author
        if self.owner is not None: ent['owner_'] = self.owner
        if self.backlink is not None: ent['backlink_'] = self.backlink
        if self.mostRecentShare is not None: ent['mostRecentShare_'] = self.mostRecentShare
        if self.notes is not None: ent['notes'] = self.notes
        if self.mod_time is not None: ent['time_'] = self.mod_time
        if self.publicId is not None: ent['publicId_'] = self.publicId
        ent['isDeleted'] = self.isDeleted
        ent['isSourcePublic'] = self.isSourcePublic
        ent['published_'] = self.published
        return ent


        # console needs idtoken, fix that
        # shuold request access when you get to console?gt

    def upload(self):
        ent = self.to_entity()
        client.put(ent)
        self.key = ent.key

    def common_xml(self):
        id_xml = ET.Element('id')
        id_xml.text = str(self.key.id)
        publicId_xml = ET.Element('publicId')
        publicId_xml.text = self.publicId
        title_xml = ET.Element('title')
        title_xml.text = self.title
        owner_xml = ET.Element('owner')
        owner_xml.text = self.owner
        author_xml = ET.Element('author')
        author_xml.text = self.author
        modified_xml = ET.Element('modified')
        modified_xml.text = str(self.mod_time)
        published_xml = ET.Element('published')
        published_xml.text = "true" if self.published else "false"
        sharedAs_xml = ET.Element('sharedAs')
        return {
            'id': id_xml,
            'publicId': publicId_xml,
            'title': title_xml,
            'owner': owner_xml,
            'author': author_xml,
            'modified': modified_xml,
            'published': published_xml,
            'sharedAs': sharedAs_xml
        }

    def to_xml_for_list(self):
        dig = ET.Element('ProgramDigest')
        common = self.common_xml()
        backlinked = self.get_backlinked_progs()

        def toEntry(prog):
            d = ET.Element('Entry')
            return d

        for prog in backlinked:
            entry = ET.Element('Entry')
            publicId = ET.Element('publicId')
            publicId.text = prog.publicId
            title = ET.Element('title')
            title.text = prog.title
            mod = ET.Element('modified')
            mod.text = str(prog.mod_time)

            entry.extend([publicId, title, mod])
            common['sharedAs'].append(entry)

        dig.extend(common.values())
        return dig

    def to_xml_for_share(self):
        fake_dig = ET.Element('Program')
        common = self.common_xml()
        fake_dig.extend(common.values())
        return fake_dig
        
    def list(author):
        '''
        Get all programs written by this author in the database
        TODO: this is limited by batch size (legacy holdover), should we fix? 
        '''
        query = client.query(kind='Program')
        query.add_filter('author_', '=', author)
        query.order = ['-time_']
        projs = list(query.fetch(limit=BATCH_SIZE))
        return map(lambda p: Program.from_entity(p), projs)

