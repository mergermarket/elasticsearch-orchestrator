#!/bin/sh

set -e

if [ "$WAIT_FOR_ES" == "true" ]
then
  yarn wait-on $ELASTICSEARCH_ENDPOINT
fi

yarn start
