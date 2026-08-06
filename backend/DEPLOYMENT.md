# Backend deployment — AWS ECS

The `backend/` project is the asynchronous worker and health service. The
full-stack Next.js frontend remains the customer-facing application and owns
Better Auth, server-side database access, and `/api` routes.

## Production database — Amazon RDS

The CloudFormation template provisions encrypted PostgreSQL with backups,
deletion protection, and a managed RDS master secret:

```bash
aws cloudformation deploy \
  --stack-name supplai-production-database \
  --template-file backend/aws/rds-postgres.yaml \
  --region us-east-1 \
  --parameter-overrides \
    VpcId=vpc-... \
    DatabaseSubnetIds='subnet-...,subnet-...' \
    AllowedDatabaseCidr='10.0.0.0/16' \
    PubliclyAccessible=false \
  --no-fail-on-empty-changeset
```

Keep RDS private. Create a dedicated `supplai_app` role and store its TLS
connection URL as the separate Secrets Manager secret
`supplai/production/database-url`. ECS tasks must not use the RDS master
credential.

The production URL has this shape:

```text
postgresql://supplai_app:URL_ENCODED_PASSWORD@RDS_ENDPOINT:5432/supplai?sslmode=require
```

## Database migrations

Build the migration image for Fargate:

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=439777529311
export ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
export IMAGE_TAG=$(git rev-parse --short=12 HEAD)-$(date +%Y%m%d%H%M%S)

docker buildx build \
  --platform linux/amd64 \
  --file backend/aws/migrations.Dockerfile \
  --tag "$ECR_REGISTRY/supplai-migrations:$IMAGE_TAG" \
  --push \
  .
```

Register the task definition with the database URL secret ARN, run it in the
database VPC, and confirm exit code `0`. Never print or commit the secret
value.

## Worker image and service

Build and push the worker image:

```bash
docker buildx build \
  --platform linux/amd64 \
  --file backend/Dockerfile \
  --tag "$ECR_REGISTRY/supplai-backend:$IMAGE_TAG" \
  --push \
  .
```

Register `backend/aws/ecs-task-definition.json`, create or update the
`supplai-backend` service in the `supplai-production` cluster, and verify:

```bash
aws logs tail /ecs/supplai-backend --since 30m --region us-east-1
```

The worker exposes `/health/live` and `/health/ready` on port `3001`. It is not
internet-facing. Use an internal service or ECS service discovery if another
private workload needs to call it.

## Secure database inspection

For a private RDS instance, use an SSM-connected temporary EC2 instance and
port forwarding rather than opening PostgreSQL to the internet:

```bash
aws ssm start-session \
  --target INSTANCE_ID \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["RDS_ENDPOINT"],"portNumber":["5432"],"localPortNumber":["15432"]}' \
  --region us-east-1
```

In a second terminal:

```bash
PGSSLMODE=require psql \
  --host=127.0.0.1 --port=15432 \
  --username=supplai_admin --dbname=supplai
```

The port-forwarding terminal must remain open while `psql` is in use.
