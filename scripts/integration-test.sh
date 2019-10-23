#!/usr/bin/env bash

set -e

function finish {
  docker-compose down
}
trap finish EXIT

docker-compose down
docker-compose build integration_test

docker-compose run integration_test
