#!/bin/sh

set -e

yarn wait-on -t "$WAIT_TIMEOUT" "$ELASTICSEARCH_ENDPOINT"

yarn test
