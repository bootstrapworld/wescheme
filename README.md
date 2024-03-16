Install needed npm modules:
```
npm install
```

Make the python environment:
```
python3.11 -m venv env
. ./env/bin/activate
python -m pip install -r requirements.txt
```

Generate a secret key:
```
python -c "import secrets; print(secrets.token_hex(20))" >secretkey
```

This should be enough to run locally:
```
python main.py
```


To *deploy*, use the following, assuming nothing's changed with your credentials since the last time you uploaded:
```
gcloud app deploy
```

