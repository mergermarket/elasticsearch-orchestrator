#!/bin/sh

set -e

yarn wait-on $ELASTICSEARCH_ENDPOINT

yarn test
