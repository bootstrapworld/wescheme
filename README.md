Install needed npm modules:
`npm install`

Make the python environment and generate secret key:
`npm run setup`

_OR:_

```
python3.11 -m venv env
. ./env/bin/activate
python -m pip install -r requirements.txt
python -c "import secrets; print(secrets.token_hex(20))" >secretkey
```

Build the runtime and compiler from source:
`npm run build`

Run WeScheme locally, at 127.0.0.1:8080:
```
python main.py
```

To *deploy*, use the following, assuming nothing's changed with your credentials since the last time you uploaded:
`gcloud app deploy`

