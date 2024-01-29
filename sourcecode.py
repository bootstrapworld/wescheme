from util import *

class SourceCode:
    def __init__(
        self, key, name=None, src=None
    ):
        self.key = key
        self.name = name
        self.src = src

    def from_parent(key):
        '''
        Pull SourceCode whose parent is the given key
        '''
        query = client.query(kind='SourceCode', ancestor=key)
        # query = client.query(kind='SourceCode')
        # query.add_filter("notes", "=", key)
        src = list(query.fetch())[0]
        print(src)
        return SourceCode.from_entity(src)

    def from_entity(ent):
        return SourceCode(
            key=ent.key,
            name=ent.get('name'),
            src=ent.get('src_'))

    def to_entity(self):
        ent = datastore.Entity(self.key, exclude_from_indexes=('src_',))
        if self.name is not None: ent['name'] = self.name
        if self.src is not None: ent['src_'] = self.src
        return ent

    def upload(self):
        client.put(self.to_entity())
