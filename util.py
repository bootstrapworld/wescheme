from flask import Flask, render_template, request, Response, session, redirect
from flask_caching import Cache
from google.cloud import datastore
import random
import time

PROD = True
LOCAL = False

BASE_62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
KEY_FILE = "secretkey"
GMAIL_EXT = "@gmail.com"
KEY_LENGTH = 10
BATCH_SIZE = 1000
TOKEN_LENGTH = 20

if PROD:
    CLIENT_ID = "981340394888-d28ji2vus7h06du2hgum27sf1mjs7ssm.apps.googleusercontent.com"
    PROJECT_ID = "wescheme-hrd-2"
    API_KEY = "AIzaSyCP00M0rthRxOPCcaVHS54iO5WfNmNA2PU"
    SITE_URL = "https://www.wescheme.org"
else:
    CLIENT_ID = "239382796313-gr5fodbdqpb7uotgpffrdelkgna1gqel.apps.googleusercontent.com"
    PROJECT_ID = "wescheme-prototyping"
    API_KEY = "AIzaSyDx3i-7tQtMquLGQvRdVCxIYZjrmPx986U"
    SITE_URL = "https://wescheme-prototyping.nn.r.appspot.com"

client = datastore.Client(PROJECT_ID)

config = {
    "DEBUG": True,          # some Flask specific configs
    "CACHE_TYPE": "SimpleCache",  # Flask-Caching related configs
    "CACHE_DEFAULT_TIMEOUT": 300
}

cache = Cache(config=config)
app = Flask(__name__)
cache.init_app(app)

# Generate new random keys with:
# $ python -c 'import secrets; print(secrets.token_hex())'
def load_secret_key():
    with open(KEY_FILE, 'r') as f:
        app.secret_key = f.read()

# Returns (formatted_email, nickname)
def format_email(email):
    fmt = email
    if GMAIL_EXT not in email:
        fmt = fmt + GMAIL_EXT
    return (fmt, email)

def randtoken():
    return "".join(random.choices(BASE_62_CHARS, k=TOKEN_LENGTH))

def get_mime(fp):
    if fp.endswith(".css"):
        return "text/css"
    elif fp.endswith(".js"):
        return "text/javascript"
    elif fp.endswith(".html.jinja") or fp.endswith(".html"):
        return "text/html"
    elif fp.endswith(".png"):
        return "image/png"
    elif fp.endswith(".svg"):
        return "image/svg"
    else:
        return "text/plain"

def epoch_time():
    return int(time.time() * 1000)
