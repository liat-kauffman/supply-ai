# Backend deployment — AWS

## Production database — Amazon RDS

`aws/rds-postgres.yaml` provisions PostgreSQL 17 with encrypted storage,
14-day backups, deletion protection, automatic minor upgrades, managed master
credentials in Secrets Manager, and required TLS connections.

Deploy it into at least two subnets in different Availability Zones:

```bash
aws cloudformation deploy \
  --stack-name supplai-production-database \
  --template-file backend/aws/rds-postgres.yaml \
  --parameter-overrides \
    VpcId=vpc-... \
    DatabaseSubnetIds='subnet-...,subnet-...' \
    AllowedDatabaseCidr='10.0.0.0/16' \
    PubliclyAccessible=false \
  --no-fail-on-empty-changeset
```

Use private subnets and `PubliclyAccessible=false` when Vercel has private VPC
connectivity. If Vercel connects directly over the internet, use public
database subnets, set `PubliclyAccessible=true`, and replace
`AllowedDatabaseCidr` with the stable Vercel egress CIDR. Never use
`0.0.0.0/0`.

Retrieve the generated master credential from the stack's
`MasterUserSecretArn` output. Use it only to create a dedicated application
role; do not put the RDS master credential in Vercel:

```sql
CREATE ROLE supplai_app LOGIN;
GRANT CONNECT, TEMPORARY ON DATABASE supplai TO supplai_app;
GRANT USAGE, CREATE ON SCHEMA public TO supplai_app;
```

Set the role's password securely with `psql`'s `\password supplai_app` command.
Build the application URL with its URL-encoded password:

```text
postgresql://supplai_app:PASSWORD@RDS_ENDPOINT:5432/supplai?sslmode=require
```

Store that full URL as `DATABASE_URL` in Vercel and as a separate Secrets
Manager secret for migration tasks. Do not commit it.

The ECS task execution role must be able to read that URL secret with
`secretsmanager:GetSecretValue` and, when a customer-managed KMS key protects
the secret, `kms:Decrypt`.

Build the one-off migration image and replace the placeholders in
`aws/migration-task-definition.json` before registering and running it in the
database VPC:

```bash
docker build -f backend/aws/migrations.Dockerfile -t supplai-migrations .
aws ecs register-task-definition \
  --cli-input-json file://backend/aws/migration-task-definition.json
```

## Asynchronous worker

The `backend` project is the asynchronous worker and operational health
service. Build its production image from the repository root so Docker can
include the shared workspace packages:

```bash
docker build -f backend/Dockerfile -t supplai-backend .
```

Push the image to a private Amazon ECR repository, then replace the three
placeholders in `aws/ecs-task-definition.json`:

- `<AWS_ACCOUNT_ID>`
- `<AWS_REGION>`
- `<IMAGE_TAG>`

Create the `/ecs/supplai-backend` CloudWatch log group and register the task:

```bash
aws logs create-log-group --log-group-name /ecs/supplai-backend
aws ecs register-task-definition \
  --cli-input-json file://backend/aws/ecs-task-definition.json
```

Run it in an ECS Fargate service with port `3001` allowed only where needed.
The container and task definition both check `/health/ready`.

The user-facing API currently remains in the full-stack Next.js frontend. The
AWS worker is separated and deployable, but moving Better Auth, server-side
page queries, and all `/api` handlers behind a standalone AWS API would be a
separate application-boundary refactor.
