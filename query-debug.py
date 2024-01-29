from util import *


# prog_key = client.key("Program", 4838056624914432)
# prog_key = client.key("Program", 5633064340291584)
prog_key = client.key("Program", 4923921426546688)
# debug_q = client.query(kind='SourceCode', ancestor=prog_key)
debug_q = client.query(kind='SourceCode', ancestor=prog_key)

ents = list(debug_q.fetch(limit=1))[0]
print(ents)





# Idea: query for all the programs in this time range (1678913868918 - around 1679429983382)
# Find programs that have no corresponding sourcecode
# delete them!

# But for now, should update everything I touch with a post-python-update entry?

# Could also be smarter about program insertion - insert program, then insert SourceCode, if sourcecode insertion fails should delete program?
# But sourcecode insertion shouldn't fail....


# ALSO WHY THE FUCK ARE THE IMAGE PROXIES FAILING????
