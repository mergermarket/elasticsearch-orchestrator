ElasticSearch Orchestrator
==========================

Container for setting up indexes based on mapping files.

* Disables automatic index creation.
* Detects when indexes are out of sync with mapping files and sets up the indexes accordingly.

Running
-------

If you have a `mappings/` folder in the current directory and valid AWS credentials set, run:

```sh
docker run \
  -v $PWD/mappings:/mappings \
  -e ELASTICSEARCH_ENDPOINT=https://my.aws.es.endpoint \
  -e SCALE_DOWN_SERVICE=ecs-service-to-scale-down-first \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  -e AWS_DEFAULT_REGION \
  mergermarket/elasticsearch-orchestrator
```
