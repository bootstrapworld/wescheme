import flask
from google.cloud import datastore
from google.oauth2 import id_token
from google.auth.transport import requests
from datetime import timedelta, UTC, datetime as datetime
import requests as py_requests

from util import client
from program import *
from sourcecode import *

import json
import random
import xml.etree.ElementTree as ET

load_secret_key()
random.seed()

"""
Places where keys need to be changed: here (util.py)
Inside openEditor-calc-min.js (extract if at all possible, for ease of change)
Also need to transfer secretkey.
"""


def error_page(
    msg="There was an error fulfilling your request! That's all we know.",
    link=("homepage", "/"),
    status=500
):
    return Response(
        render_template("error.html.jinja", msg=msg, desc=link[0], url=link[1]),
        status=status
    )

# Returns True iff session cookies demonstrate a sufficiently recent, valid session.
# If False, session is invalid, and therefore cleared.
def logged_in():
    now = datetime.now(UTC)
    ret = (('fname' in session)
        and ('datetime' in session)
        and (session['datetime'] < now)
        and (now - session['datetime'] < timedelta(seconds=60*60*24)))  # Sessions last 1 day, max
    if not ret: session.clear()
    return ret

@app.route("/favicon.ico")
def favicon():
    with app.open_resource(f"static/img/favicon.ico", 'rb') as f:
        return Response(f.read(), mimetype="image/vnd.microsoft.icon")

@app.route("/images/<path:imgpath>")
def images_intercept(imgpath):
    with app.open_resource(f"static/img/{imgpath}", 'rb') as f:
        return Response(f.read(), mimetype=get_mime(imgpath))


@app.route("/doc/<path:comp>")
def docs(comp):
    with app.open_resource(f"doc/{comp}", 'r') as f:
        return Response(f.read(), mimetype=get_mime(comp))

def viewmaker(page):
    return lambda: render_template(page + ".html.jinja")

for page in ["about", "contact", "privacy", "copyright"]:
    app.add_url_rule("/" + page, endpoint=page, view_func=viewmaker(page))

@app.route("/")
def root():
    return render_template(
        "index.html.jinja",
        logged_in=logged_in(),
        client_id=CLIENT_ID,
        site_url=SITE_URL)

@app.route("/codemirror5/<path:cm_filepath>")
def get_cm_file(cm_filepath):
    with app.open_resource(f"codemirror5/{cm_filepath}", 'r') as f:
        return Response(f.read(), mimetype=get_mime(cm_filepath))

@app.route("/node_modules/google-closure-library/<path:goog_filepath>")
def get_goog_file(goog_filepath):
    with app.open_resource(f"node_modules/google-closure-library/{goog_filepath}", 'r') as f:
        return Response(f.read(), mimetype=get_mime(goog_filepath))

@app.route("/js/mzscheme-vm/<path:rest>")
def get_js(rest):
    return redirect("/static/mzscheme-vm/" + rest)
    
@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    def callback(resp):
        resp.delete_cookie('g_csrf_token')
        resp.delete_cookie('token')
        return resp

    flask.after_this_request(callback)
    return redirect("/")

@app.route("/login", methods=["GET", "POST"])
def login():
    try:
        # Google is not using SameSite attributes correctly, so I can't make the below code reliable.
        # csrf_token_cookie = request.cookies.get('g_csrf_token')
        # if not csrf_token_cookie:
        #     return error_page(
        #         msg="The WeScheme server didn't receive the CSRF token cookie from Google. Try relaxing your cookie privacy settings.",
        #         status=400)
        # csrf_token_body = request.args.get('g_csrf_token')
        # if not csrf_token_body:
        #     return error_page(
        #         msg="The WeScheme server didn't receive the CSRF token GET parameter from Google. This is Google's fault!!",
        #         status=500)
        # if csrf_token_cookie != csrf_token_body:
        #     return error_page(
        #         msg="CSRF token cookie doesn't match CSRF token parameter. Are you trying to hack us? :'(",
        #         status=400)

        id_info = id_token.verify_oauth2_token(request.form['credential'], requests.Request(), CLIENT_ID)

        # fname is formatted email - formatted in the weird way that the legacy wescheme backend did it
        session['fname'], session['nickname'] = format_email(id_info['email'])
        print(session)
        session['datetime'] = datetime.now(UTC)

        def callback(resp):
            resp.delete_cookie('g_csrf_token')
            resp.set_cookie('token', randtoken())
            return resp

        # When the response gets made, set a randomized token for CSRF defense.
        flask.after_this_request(callback)

    except Exception as e:
        print("verification failed", e)
        return error_page(msg="Authentication failed", status=400)

    return redirect("/")

@app.route("/openEditor")
def open_editor():
    flags=[]
    ctx={}

    if logged_in():
        flags.append('logged_in')
        ctx['name'] = session['nickname']

    if 'publicId' in request.args:
        flags.append('remix')
        ctx['publicId'] = request.args['publicId']

    if 'pid' in request.args:
        flags.append('pid')
        ctx['pid'] = request.args['pid']

    return render_template(
        "open-editor.html.jinja",
        flags=flags, ctx=ctx,
        api_key=API_KEY, client_id=CLIENT_ID, app_id=PROJECT_ID)

# True iff request was POST and POST'd token matches cookie'd token
def is_intentional():
    return (('token' in request.form)
        and ('token' in request.cookies)
        and (request.form['token'] == request.cookies['token']))

def save_existing_program():
    form = request.form
    pid = int(form['pid'])
    extant = Program.from_id(pid)
    src = SourceCode.from_parent(extant.key)

    # print(extant)
    # print(extant.owner)
    # print(extant.published)

    if extant.owner == session['fname'] and (not extant.published):
        if 'title' in form: extant.title = form['title']
        if 'code' in form: src.src = form['code']
        if 'notes' in form: extant.notes = form['notes']
        if extant.publicId is None: extant.publicId = Program.gen_publicId()
        extant.upload()
        src.upload()

    #TODO: throw error if not allowed
    return Response(str(pid), mimetype="text/plain")

def save_new_program():
    form = request.form
    prog = Program(
        title=form['title'],
        author=session['fname'],
        owner=session['fname'],
        notes=form['notes'] if 'notes' in form else None)

    prog.upload()
    src_key = client.key(*prog.key.flat_path, "SourceCode")
    src = SourceCode(
        src_key,
        form['title'],
        form['code']
    )
    src.upload()
    return Response(str(prog.key.id), mimetype="text/plain")

# Save requests need to respond with resulting id
@app.route("/saveProject", methods=["POST"])
def save_project():
    if not logged_in() or not is_intentional():
        return ""

    if "pid" in request.form:
        return save_existing_program()
    else:
        return save_new_program()

@app.route("/console")
def console():
    if not logged_in():
        return error_page(msg="You need to log in to access this page!", status=401)

    flags=['logged_in']
    ctx={'name': session['nickname']}

    return render_template("console.html.jinja", flags=flags, ctx=ctx)

# The way sharing works is it first sends a request here, to make a cloned version of the program.
# This request returns the pid of that clone, and then the site sends another request, to shareProject,
# to actually publish the clone. Kinda funky.
@app.route("/cloneProject", methods=["POST"])
def clone_project():
    if not logged_in() or not is_intentional():
        return ""

    pid = int(request.form['pid'])
    old = Program.from_id(pid)

    if old.owner != session['fname'] and (not old.published):
        return ""

    cloned = Program(
        title=old.title,
        backlink=old.key.id,
        notes=old.notes,
        mod_time=old.mod_time
    )

    cloned.upload()
    old.mostRecentShare = cloned.key.id

    old_src = SourceCode.from_parent(old.key)

    cloned_src = SourceCode(
        client.key(*cloned.key.flat_path, "SourceCode"),
        name=old_src.name,
        src=old_src.src
    )

    if 'code' in request.form:
        cloned_src.src = request.form['code']

    cloned_src.upload()

    return Response(str(cloned.key.id), mimetype="text/plain")

@app.route("/deleteProject", methods=["POST"])
def delete_project():
    if not logged_in() or not is_intentional():
        return ""

    form = request.form
    prog = Program.from_id(int(form['pid']))

    if (prog.owner != session['fname']):
        return ""

    prog.isDeleted = True
    prog.upload()
    return ""

@cache.memoize(300)
def get_img(url):
    return py_requests.get(url).content

@app.route("/imageProxy")
def image_proxy():
    url = request.args['url']
    return Response(get_img(url), mimetype="image/png")

@app.route("/listProjects")
def list_projects():
    if not logged_in():
        return ""

    projs = Program.list(session['fname'])
    digs = ET.Element("ProgramDigests")
    for proj in projs:
        if not proj.isDeleted:
            digs.append(proj.to_xml_for_list())

    return Response(ET.tostring(digs), mimetype="text/xml")

def prog_src_to_json(prog, src):
    src_dict = {}
    src_dict['src'] = src.src
    src_dict['name'] = src.name

    ret = {}
    ret['owner'] = prog.owner
    ret['isSourcePublic'] = prog.isSourcePublic
    ret['notes'] = prog.notes if prog.notes is not None else ""
    ret['author'] = prog.author
    ret['source'] = src_dict
    ret['published'] = prog.published
    ret['title'] = prog.title
    ret['permissions'] = []
    ret['modified'] = prog.mod_time
    ret['id'] = prog.key.id
    ret['publicId'] = prog.publicId

    sharedAs = prog.get_backlinked_progs()
    def toEntry(prog):
        d = {}
        d['publicId'] = prog.publicId
        d['title'] = prog.title
        d['modified'] = prog.mod_time
        return d

    ret['sharedAs'] = list(map(toEntry, sharedAs))
    return json.dumps(ret)

# TODO:
#     make error pages for logged_out, wrong_user, etc.

@app.route("/loadProject")
def load_project():
    if 'pid' in request.args:
        if not logged_in():
            return ""
        prog = Program.from_id(int(request.args['pid']))
        if prog.owner != session['fname']:
            return ""
        src = SourceCode.from_parent(prog.key)
        resp = prog_src_to_json(prog, src)
        return Response(resp, mimetype="text/json")

    # ITS CUZ SHARED STUFF DOESNT HAVE NEW SOURCE CODES

    elif 'publicId' in request.args:
        prog = Program.from_publicId(request.args['publicId'])

        if not prog.published:
            if not logged_in():
                return ""
            elif prog.owner != session['fname']:
                print(session)
                return ""

        src = SourceCode.from_parent(prog.key)
        resp = prog_src_to_json(prog, src)
        return Response(resp, mimetype="text/json")

    else:
        return BadRequest(description="Requests to loadProject must include either 'pid' or 'publicId' in GET parameters")

@app.route("/shareProject", methods=['POST'])
def share_project():
    if not logged_in() or not is_intentional():
        print("attempted share, but not logged in or detected CSRF")
        return ""

    prog = Program.from_id(int(request.form['pid']))

    if (prog.owner != session['fname']) or prog.published:
        print("attempted share, but wrong user")
        return ""

    public = request.form['isPublic'] == 'true'
    prog.published = True
    prog.isSourcePublic = public
    prog.time = epoch_time()
    prog.upload()
    return Response(ET.tostring(prog.to_xml_for_share()), mimetype="text/xml")

@app.route("/view")
def view():
    if 'publicId' not in request.args:
        return Response(render_template("view.html.jinja", publicId=None, prog=None), status=400)

    publicId = request.args['publicId']
    prog = Program.from_publicId(publicId)
    notes = prog.notes if prog.notes is not None else "\n"

    return Response(
        render_template(
            "view.html.jinja",
            publicId=publicId, prog=prog,
            title=prog.title, notes=notes, isPublic=prog.isSourcePublic))

@app.route("/run")
def run():
    if 'publicId' not in request.args:
        return Response(render_template("run.html.jinja", publicId=None, prog=None), status=400)

    publicId = request.args['publicId']
    prog = Program.from_publicId(publicId)
    notes = prog.notes if prog.notes is not None else "\n"

    return Response(
        render_template(
            "run.html.jinja",
            publicId=publicId, prog=prog,
            title=prog.title, notes=notes, isPublic=prog.isSourcePublic))

if __name__ == "__main__":
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    # Flask"s development server will automatically serve static files in
    # the "static" directory. See:
    # http://flask.pocoo.org/docs/1.0/quickstart/#static-files. Once deployed,
    # App Engine itself will serve those files as configured in app.yaml.

    LOCAL = True
    SITE_URL = "http://localhost:8080"

    app.run(host="127.0.0.1", port=8080, debug=True, use_evalex=False)
