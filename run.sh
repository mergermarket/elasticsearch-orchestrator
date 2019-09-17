#!/usr/bin/env bash

if [ "$WAIT_FOR_ES" == "true" ]
then
  yarn wait-on $ELASTICSEARCH_ENDPOINT
fi

yarn
