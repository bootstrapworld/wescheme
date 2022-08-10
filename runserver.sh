#!/bin/bash

./lib/google-cloud-sdk/bin/java_dev_appserver.sh \
	--jvm_flag=--add-opens=java.base/sun.net.www.protocol.http=ALL-UNNAMED \
	--jvm_flag=--add-opens=java.base/sun.net.www.protocol.https=ALL-UNNAMED \
	--jvm_flag=--add-opens=java.base/java.net=ALL-UNNAMED \
	war

exit 0