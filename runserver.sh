#!/bin/bash


# install cloud sdk if it's not already installed
if ! [ -d lib/google-cloud-sdk/ ]
then
    echo "The Google Cloud SDK hasn't been installed yet"
    echo "Running silent deployment script...(from https://cloud.google.com/sdk/docs/downloads-interactive#silent)"
    curl https://sdk.cloud.google.com > install.sh
    bash install.sh --disable-prompts --install-dir=lib/
    rm install.sh
fi

# run the local appserver
# TODO(Emmanuel): figure out to emulate the datastore locally as well
./lib/google-cloud-sdk/bin/java_dev_appserver.sh \
	--jvm_flag=--add-opens=java.base/sun.net.www.protocol.http=ALL-UNNAMED \
	--jvm_flag=--add-opens=java.base/sun.net.www.protocol.https=ALL-UNNAMED \
	--jvm_flag=--add-opens=java.base/java.net=ALL-UNNAMED \
	war

exit 0