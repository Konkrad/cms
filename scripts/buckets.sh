docker exec minio sh -c "mc alias set local http://localhost:9000 test testtest"
docker exec minio sh -c "mc anonymous set download local/data/public"
