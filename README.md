# ElasticSearch Orchestrator

Container for setting up indexes based on mapping files.

- Disables automatic index creation.
- Detects when indexes are out of sync with mapping files and scales down the specified service.
- Sets up any indexes that do not exist or destroys any that are orphaned.

## Scaling down the services if a reindex is required

To spin down a service as part of a run of the orchestrator it is necessary to specify the name of the service to scale down as the `SCALE_DOWN_SERVICE` environment property.

## Managing the indices

To actually manage the indices during a run of the orchestrator it is necessary to specify that we should set `MANAGE_INDICES` to `true`.

## Running

If you have a `mappings/` folder in the current directory and valid AWS credentials set, run:

```sh
docker run \
  -v $PWD/mappings:/mappings \
  -e ELASTICSEARCH_ENDPOINT=https://my.aws.es.endpoint \
  -e NUMBER_OF_SHARDS=1 \
  -e SCALE_DOWN_SERVICE=ecs-service-to-scale-down-first \
  -e MANAGE_INDICES=true \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  -e AWS_DEFAULT_REGION \
  mergermarket/elasticsearch-orchestrator
```

## Testing

```sh
./scripts./integration-test.sh
```
