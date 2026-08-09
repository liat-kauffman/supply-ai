# Supplai: go-forward deployment plan

This is the operating guide for taking Supplai from the repository to production.

## Current production state

Supplai is currently deployed AWS-only. The live path is:

```text
https://supplai-pilot.com
  -> HTTPS Application Load Balancer
  -> ECS Fargate service: supplai-frontend
  -> private Amazon RDS PostgreSQL
```

The worker runs as a separate `supplai-backend` ECS Fargate service. ECR stores
the images, Secrets Manager stores production credentials, Resend sends
authentication email, and Gemini powers receipt/photo proposals. The frontend
is not currently deployed to Vercel.

The current application also includes an AI area-photo inventory workflow. It
identifies visible products from the selected storage area, shows editable
proposals, and only updates inventory after a manager approves the results.

The current deployment has been completed manually and through GitHub Actions.
The GitHub workflow currently builds Linux/AMD64 images, pushes them to ECR,
registers ECS task definitions, updates the ECS services, and waits for the
services to become stable. It currently uses protected AWS credentials in
GitHub Actions; migrating that workflow to GitHub OIDC is still recommended.

The historical Vercel/EKS options below are retained as future alternatives.
For current operations, follow the focused [frontend ECS guide](frontend/DEPLOYMENT.md)
and [backend ECS guide](backend/DEPLOYMENT.md) first.

It is based on the files currently in this repository:

- `frontend/` is a full-stack Next.js application. Its pages, Better Auth handler, server-side database access, and `/api` routes run in ECS Fargate.
- `backend/` is an independent TypeScript worker with a health service on port `3001`.
- `packages/database/` owns Prisma, PostgreSQL migrations, and the database client.
- `packages/domain/` contains shared validation and domain rules.
- `backend/aws/rds-postgres.yaml` provisions the production RDS database.
- `backend/aws/ecs-task-definition.json` and the Dockerfiles support AWS ECS today.
- `.github/workflows/ci.yml` runs validation and deploys changed services to ECS on pushes to `main`.
- `infra/kubernetes/local/` contains local Kubernetes manifests for learning and testing. There is no production EKS deployment.

## Target architecture

Use this architecture as the current production architecture:

```text
Users
  |
  v
AWS ECS: Next.js frontend + Better Auth + API routes
  |
  | TLS PostgreSQL connection
  v
AWS: private RDS PostgreSQL ---- AWS Secrets Manager

AWS ECS: backend worker deployment
  |
  +-- CloudWatch logs and ECS health checks
```

The current path is staged as follows:

1. AWS networking, RDS, Secrets Manager, ECR, ALB, HTTPS, and ECS are in place.
2. The frontend and worker run on ECS Fargate.
3. GitHub Actions validates, builds, publishes, and deploys changed services.
4. Production hardening remains: OIDC, staging, backups/restore drills, monitoring, and rollback testing.
5. Use EKS only if future scale or operational requirements justify its additional complexity.

## Current gaps to close

- Migrate GitHub Actions from stored AWS access keys to GitHub OIDC.
- Add a staging AWS environment and separate staging secrets/database.
- Automate production Prisma migrations as an approval-gated ECS task.
- Add RDS backup verification and a tested restore procedure.
- Add CloudWatch alarms, application error tracking, and deployment notifications.
- Add ECS deployment rollback and smoke tests after deployment.
- Add tenant-isolation, permissions, inventory, receipt, order, and AI approval tests.
- Document the incident response and recovery procedures.
- Keep Vercel and EKS as optional future alternatives; do not operate duplicate production runtimes without a deliberate migration plan.

## Phase 0 — prepare locally

From the repository root:

```bash
# Run this only if `pnpm --version` does not already work.
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the application locally before deploying:

```bash
cp .env.example .env
set -a
source .env
set +a
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Generate a real production auth secret; never reuse the local value:

```bash
openssl rand -base64 32
```

Before production, also verify that authentication email delivery works with Resend or the configured webhook. Production intentionally fails if email delivery is not configured.

## Phase 1 — build the AWS cloud foundation

Use one AWS account and region for the first production environment. Set the region explicitly in every terminal session, for example:

```bash
export AWS_REGION=eu-central-1
aws sts get-caller-identity
aws configure set region "$AWS_REGION"
```

Create or confirm:

1. A VPC spanning at least two Availability Zones.
2. Private subnets for RDS and EKS worker nodes.
3. NAT egress or another controlled outbound path for private worker nodes.
4. An RDS security group allowing `5432` only from the trusted application network.
5. An EKS node/pod security group allowing the worker's required traffic only.
6. CloudTrail, account MFA, billing alerts, and an administrative break-glass process.

Do not put production PostgreSQL on `0.0.0.0/0`. The checked-in CloudFormation template deliberately requires an explicit `AllowedDatabaseCidr`.

### Provision PostgreSQL

Use the existing template rather than creating a second, inconsistent database definition:

```bash
aws cloudformation deploy \
  --stack-name supplai-production-database \
  --template-file backend/aws/rds-postgres.yaml \
  --parameter-overrides \
    VpcId=vpc-REPLACE_ME \
    DatabaseSubnetIds='subnet-REPLACE_ME,subnet-REPLACE_ME' \
    AllowedDatabaseCidr='10.0.0.0/16' \
    PubliclyAccessible=false \
  --no-fail-on-empty-changeset
```

Keep `PubliclyAccessible=false` when the selected Vercel-to-AWS connectivity method supports private access. If direct public access is required, use a narrow, stable Vercel egress range and document the exception.

Retrieve the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name supplai-production-database \
  --query 'Stacks[0].Outputs'
```

Use the RDS master secret only to create a dedicated application role. The frontend and migration job must not use the master account. Store the application connection string in Secrets Manager and Vercel; never commit it.

The connection string must use TLS:

```text
postgresql://supplai_app:URL_ENCODED_PASSWORD@RDS_ENDPOINT:5432/supplai?sslmode=require
```

### Create ECR repositories

Create private repositories for the worker and migration image:

```bash
aws ecr create-repository --repository-name supplai-backend
aws ecr create-repository --repository-name supplai-migrations
```

Enable image scanning, lifecycle cleanup, and immutable tags in the AWS console or with your organization's standard ECR policy. Use the Git commit SHA as the immutable image tag; do not deploy `latest`.

## Historical alternative — deploy the frontend to Vercel

This section is not part of the current production path. Use it only if the
team deliberately chooses to move the full-stack frontend away from ECS.

Create a Vercel project connected to this repository with:

- Root Directory: `frontend`
- Include source files outside the Root Directory: enabled
- Production branch: `main`

The existing `frontend/vercel.json` already installs from the root workspace and builds the frontend.

Set these Vercel production variables:

```text
DATABASE_URL=the TLS RDS application URL
BETTER_AUTH_SECRET=a new 32+ character random secret
BETTER_AUTH_URL=https://your-production-domain.example
RESEND_API_KEY=your production Resend key
AUTH_EMAIL_FROM=Supplai <verified-sender@example.com>
GEMINI_API_KEY=your production Gemini key
GEMINI_MODEL=your selected model
GEMINI_FALLBACK_MODEL=your selected fallback
SUPER_ADMIN_USER_IDS=only when platform administration is enabled
```

Use separate Preview and Production values where appropriate. Never paste `.env` or the local Docker URL into Vercel.

Deploy once manually from Vercel, then verify:

```text
https://your-production-domain.example/api/health/live
https://your-production-domain.example/api/health/ready
```

Register a test account, verify its email, create a test organization, upload a test receipt, and confirm that organization isolation and manager approval rules work against production-like data.

## Phase 3 — database migrations

Migrations are release operations, not application startup operations. Use committed Prisma migrations and run:

```bash
pnpm --filter @supply/database migrate:deploy
```

Run it with the production `DATABASE_URL` from a protected migration environment. The existing `backend/aws/migrations.Dockerfile` is intended for this purpose.

Release order:

1. Build and validate the release.
2. Run a backward-compatible migration.
3. Deploy the application and worker images.
4. Run smoke tests.
5. Remove old database columns only in a later release after the old application is gone.

Never use `prisma migrate dev` against production. Take/verify an RDS snapshot and confirm the migration is reversible or has a tested recovery plan before applying it.

## Phase 4 — Kubernetes on AWS (EKS)

Kubernetes is not configured in this repository yet. Add it under `infra/kubernetes/` or use a Helm chart. Keep Kubernetes configuration separate from application source code.

Create an EKS cluster with private worker nodes and at least two Availability Zones. Use the AWS EKS best-practice setup for:

- IAM Roles for Service Accounts (IRSA) or EKS Pod Identity;
- encrypted secrets and restricted namespaces;
- Cluster Autoscaler or Karpenter;
- CloudWatch/container logs;
- an ingress/load balancer only if the worker later needs inbound traffic.

The current worker only exposes health endpoints on port `3001`; it does not need to be internet-facing. The initial Kubernetes workload should therefore be a `Deployment` with:

- `replicas: 1` until duplicate processing is understood;
- environment values such as `NODE_ENV=production` and `HEALTH_PORT=3001`;
- `DATABASE_URL` sourced from an external secret, not a committed Kubernetes Secret;
- a readiness probe on `/health/ready`;
- a liveness probe on `/health/live`;
- CPU and memory requests/limits;
- a PodDisruptionBudget once there are multiple replicas;
- a non-root security context;
- rolling updates with a small, controlled surge.

Example probe configuration for the future Deployment:

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  periodSeconds: 30
```

Do not put the RDS password directly in `deployment.yaml`. Use AWS Secrets Manager with the Secrets Store CSI Driver, External Secrets Operator, or the organization's approved secret integration. Grant access to only the worker's Kubernetes service account.

If EKS is not ready, use the existing ECS task definition as the interim worker deployment. The Docker image and health contract remain the same.

## Phase 5 — automate CI/CD

The current `.github/workflows/ci.yml` is CI only. Keep it required on pull requests. It already runs formatting, linting, type checking, tests, and the production build.

Add these workflows:

### Pull request CI

Keep the existing checks required before merge. Add, when available:

- dependency/security scanning;
- Docker build checks for `backend/Dockerfile` and `backend/aws/migrations.Dockerfile`;
- a migration smoke test against a temporary PostgreSQL service;
- preview deployment for the frontend.

### Production release

Trigger on a merge to `main` or, preferably, a version tag. The workflow should:

1. Run the same validation as PR CI.
2. Build the backend and migration images from the repository root.
3. Tag both images with the Git SHA and push them to private ECR.
4. Authenticate to AWS using GitHub Actions OIDC and a narrowly scoped IAM role. Do not store `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` as GitHub secrets.
5. Run the migration as a protected environment job requiring approval.
6. Deploy the immutable backend image to EKS with `kubectl` or Helm.
7. Wait for rollout completion and fail if the readiness probe does not pass.
8. Run frontend deployment through the Vercel Git integration or a Vercel deploy job.
9. Run smoke tests against the production URL.
10. Publish the image digest, migration result, deployment URL, and commit SHA as job artifacts.

Use GitHub Environments named `staging` and `production`. Require approval for production migrations and deployments. Restrict production deployment to `main` or signed release tags.

The CD pipeline must deploy by SHA/digest, not by a mutable tag:

```text
supplai-backend:git-<commit-sha>
```

Rollback procedure:

1. Roll back the EKS Deployment to the previous image digest.
2. Inspect logs and health endpoints.
3. Do not automatically roll back database migrations. Restore or apply a forward fix using the tested database recovery plan.
4. Record the incident and add a regression test before redeploying.

## Required environment and secret inventory

Maintain this inventory outside the repository, in the team's password/secrets manager:

| Secret/value                   | Where used                              | Owner             |
| ------------------------------ | --------------------------------------- | ----------------- |
| RDS application `DATABASE_URL` | ECS task definitions and migration task | Platform owner    |
| `BETTER_AUTH_SECRET`           | ECS frontend task                       | Application owner |
| Resend API key and sender      | ECS frontend task                       | Application owner |
| Gemini API key/model settings  | ECS frontend task                       | Application owner |
| ECR/ECS deployment role        | GitHub Actions                          | Platform owner    |
| RDS master secret              | AWS Secrets Manager only                | Platform owner    |

Rotate secrets on a schedule and immediately after accidental exposure. Keep `.env.example` non-sensitive and updated whenever a variable is added.

## Go-live checklist

- [ ] AWS account MFA, billing alerts, CloudTrail, and least-privilege access are configured.
- [ ] RDS is encrypted, Multi-AZ, backed up for 14 days, deletion-protected, and not open to the internet.
- [ ] A dedicated application database role is used instead of the RDS master user.
- [x] ECS production task secrets and environment variables are set; Vercel is not required for the current deployment.
- [ ] Authentication email delivery and the verified sender work.
- [ ] Prisma migrations have been applied with `migrate deploy`.
- [x] CI runs on pull requests and pushes to `main`.
- [ ] CD uses OIDC, protected production approval, and smoke tests. Current CD uses protected AWS access-key secrets and should be migrated to OIDC.
- [x] The worker is running in exactly one intended production runtime: ECS.
- [ ] Worker readiness/liveness checks and logs are visible.
- [ ] RDS restore and application rollback have been tested.
- [ ] A staging environment exists before production data is used.
- [ ] Monitoring covers HTTP errors, auth email failures, database connectivity, worker restarts, and migration failures.

## Recommended implementation order

1. Migrate the existing ECS GitHub Actions deployment to OIDC.
2. Add staging and protected production environments.
3. Add approval-gated migrations, smoke tests, and ECS rollback.
4. Add monitoring, backups/restore drills, and documented incident response.
5. Add tenant-isolation and end-to-end workflow tests.
6. Consider EKS only if ECS no longer meets the operational requirements.

This sequencing matches the repository's current modular-monolith design and preserves the approval, tenancy, audit, and migration safety rules already established in the ADRs.

## Junior walkthrough: do this in order

This section expands every phase above. Read the explanation before running a command. A command containing `REPLACE_ME` is an example only; replace every placeholder with your own value.

### How the pieces fit together

There are four different jobs involved:

- **Vercel** hosts the customer-facing Next.js application. It also runs the application's server code and API routes.
- **AWS RDS** stores users, organizations, inventory, receipts, and audit data in PostgreSQL.
- **AWS ECR** stores Docker images. Think of it as a private shelf for your backend images.
- **ECS or EKS** runs the backend worker. ECS is the existing simpler AWS option. EKS is AWS's Kubernetes service.
- **GitHub Actions** runs checks and deployment jobs when code is pushed.

The application will not work correctly if only one piece is deployed. For example, Vercel can host the frontend, but it still needs a reachable production database and correctly configured authentication secrets.

### Step 1 — install and verify the tools

Install these tools on your computer before doing cloud work:

1. Node.js 22 or newer.
2. pnpm 11.9.0.
3. Docker Desktop.
4. Git.
5. The AWS CLI.
6. The Vercel CLI, optional because the Vercel website can deploy the frontend.
7. `kubectl`, `eksctl`, and Helm, but only when you begin the EKS phase.

Check each installation:

```bash
node --version
pnpm --version
docker --version
git --version
aws --version
```

If a command says `command not found`, install that tool before continuing. Do not try to fix a missing tool by changing the application code.

For AWS, create an account only through the official AWS website. Turn on multi-factor authentication for the root account, then stop using the root account for normal work. Create an administrator identity for initial setup, and later replace it with smaller, task-specific permissions.

Configure the AWS CLI:

```bash
aws configure
```

It will ask for an access key, secret key, region, and output format. For early setup you may use an administrator identity, but do not put these keys into GitHub, Vercel, `.env`, Docker images, or source files. Later, GitHub Actions should use OIDC instead of stored AWS keys.

Confirm that the CLI is connected to the account you expect:

```bash
aws sts get-caller-identity
```

If the returned account number is not yours, stop. You could otherwise create expensive infrastructure in the wrong account.

### Step 2 — get the local application working

Do this before creating cloud infrastructure. Local success gives you a known-good baseline.

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
set -a
source .env
set +a
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`. The local PostgreSQL database is exposed on port `5433` on your computer, while the containers communicate internally on PostgreSQL's normal port `5432`.

If `cp .env.example .env` reports that the file already exists, do not overwrite it automatically. Open the existing file and check that `DATABASE_URL` points to the local Docker database. Generate a local auth secret with:

```bash
openssl rand -base64 32
```

Copy that output into `BETTER_AUTH_SECRET` in `.env`.

The `set -a` and `source .env` commands are important. The Prisma CLI and seed
script run from `packages/database`, while your environment file is at the
repository root. Loading the file into the shell makes `DATABASE_URL` visible
to both commands. You must repeat those three commands in every new terminal
session before running `pnpm db:migrate` or `pnpm db:seed`:

```bash
set -a
source .env
set +a
```

Check these URLs:

```text
http://localhost:3000/api/health/live
http://localhost:3000/api/health/ready
http://localhost:3001/health/live
http://localhost:3001/health/ready
```

`live` means the process is running. `ready` means it is able to serve traffic, including its required database checks. If readiness fails, inspect the terminal running `pnpm dev` and confirm PostgreSQL is running:

```bash
docker compose ps
docker compose logs postgres
```

Stop local services when finished with:

```bash
docker compose down
```

Do not use `docker compose down -v` unless you intentionally want to delete the local database volume and all local seed data.

### Step 3 — create a simple AWS cost and safety guardrail

Before creating RDS, open the AWS Billing console and create:

1. A monthly budget alert.
2. An email notification for forecasted or actual spend.
3. Tags for `Application=Supplai` and `Environment=production`.

AWS resources cost money while they exist. RDS, NAT gateways, EKS clusters, load balancers, and public IPv4 addresses are especially important to monitor. If this is only a test deployment, use a separate `staging` environment and destroy it when finished.

### Step 4 — create the AWS network

The network is the private area in AWS where your database and worker live. A VPC is the overall network. A subnet is a smaller section of that network. An Availability Zone is a separate AWS datacenter area.

Use the VPC console's **Create VPC** wizard and choose a production-style setup with:

- one VPC;
- at least two Availability Zones;
- private subnets for RDS and EKS nodes;
- public subnets only for public load balancers or NAT gateways;
- DNS hostnames and DNS resolution enabled.

Write down these values in a private deployment notes document:

```text
AWS account ID:
AWS region:
VPC ID:
Private subnet A:
Private subnet B:
Public subnet A:
Public subnet B:
```

Do not paste these notes into a public issue or commit them if they contain sensitive account details.

For a first deployment, the AWS console is acceptable because it makes the network relationships visible. Once the design is stable, manage the VPC with Terraform or CloudFormation so it can be recreated consistently. The repository currently contains CloudFormation for RDS only, not for the entire network.

### Step 5 — provision RDS PostgreSQL

RDS is the managed database. AWS handles the database server, backups, patching, and failover configuration; your application still owns its schema and migrations.

First identify the VPC ID and two private subnet IDs. Then decide what `AllowedDatabaseCidr` means. It is the network range allowed to connect to PostgreSQL. It must be the narrowest network that actually needs access:

- For a private worker in the same VPC, use the worker network range or, preferably, change the security-group design to allow the worker security group.
- For direct Vercel access, use only the provider's documented stable egress range if your plan supports one.
- Never use `0.0.0.0/0`.

Validate the CloudFormation template before deployment:

```bash
aws cloudformation validate-template \
  --template-body file://backend/aws/rds-postgres.yaml
```

Deploy it:

```bash
aws cloudformation deploy \
  --stack-name supplai-production-database \
  --template-file backend/aws/rds-postgres.yaml \
  --parameter-overrides \
    VpcId=vpc-REPLACE_ME \
    DatabaseSubnetIds='subnet-REPLACE_ME,subnet-REPLACE_ME' \
    AllowedDatabaseCidr='10.0.0.0/16' \
    PubliclyAccessible=false \
  --no-fail-on-empty-changeset
```

The command may take several minutes. Check its status:

```bash
aws cloudformation describe-stacks \
  --stack-name supplai-production-database \
  --query 'Stacks[0].StackStatus'
```

Continue only when the status is `CREATE_COMPLETE` or `UPDATE_COMPLETE`. If it fails, inspect the CloudFormation Events tab and do not repeatedly rerun it without understanding the failed resource.

Get the endpoint and secret ARN:

```bash
aws cloudformation describe-stacks \
  --stack-name supplai-production-database \
  --query 'Stacks[0].Outputs'
```

The endpoint is a hostname, not a complete connection URL. The template creates a managed master password in AWS Secrets Manager. Retrieve it only when creating the application database user, and do not put the master password in Vercel.

Create the application user from a secure administrative PostgreSQL session. Use the actual database name and a strong, unique password:

```sql
CREATE ROLE supplai_app LOGIN PASSWORD 'REPLACE_WITH_A_STRONG_PASSWORD';
GRANT CONNECT, TEMPORARY ON DATABASE supplai TO supplai_app;
GRANT USAGE, CREATE ON SCHEMA public TO supplai_app;
```

Use a password manager, and URL-encode special characters in the password before placing it in `DATABASE_URL`. For example, `@` becomes `%40` and a space becomes `%20`.

Important: the first application user needs permission to run Prisma migrations. Later, you may split this into a runtime user and a migration user with fewer runtime permissions. Do not casually remove `CREATE` or schema permissions until you have separated those users.

### Step 6 — create ECR and publish the worker image

ECR is the private registry where EKS or ECS downloads your image.

Create the repositories:

```bash
aws ecr create-repository --repository-name supplai-backend
aws ecr create-repository --repository-name supplai-migrations
```

If a repository already exists, AWS will report that. That is safe; check the repository rather than creating another one with a different name.

Log Docker into ECR. Replace `AWS_ACCOUNT_ID` with the number returned by `aws sts get-caller-identity`:

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
```

Build the images from the repository root, not from `backend/`. The Dockerfiles need the shared workspace packages:

```bash
IMAGE_TAG=git-$(git rev-parse --short=12 HEAD)
docker build -f backend/Dockerfile -t supplai-backend:"$IMAGE_TAG" .
docker build -f backend/aws/migrations.Dockerfile -t supplai-migrations:"$IMAGE_TAG" .
```

Tag and push them:

```bash
ECR_HOST="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker tag supplai-backend:"$IMAGE_TAG" "$ECR_HOST/supplai-backend:$IMAGE_TAG"
docker tag supplai-migrations:"$IMAGE_TAG" "$ECR_HOST/supplai-migrations:$IMAGE_TAG"
docker push "$ECR_HOST/supplai-backend:$IMAGE_TAG"
docker push "$ECR_HOST/supplai-migrations:$IMAGE_TAG"
```

If a Docker build fails, first run `pnpm build` locally. Common causes are building from the wrong directory, an out-of-date lockfile, or a missing environment value needed at build time.

### Step 7 — deploy Vercel manually

In Vercel:

1. Select **Add New Project**.
2. Import the GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Keep **Include source files outside of the Root Directory** enabled.
5. Select the production branch, normally `main`.
6. Add the production environment variables listed in the earlier Vercel section.
7. Deploy.

The root directory setting matters because the app is part of a pnpm monorepo. If you set the root to the repository root, Vercel may build the wrong package. If you disable files outside the root, imports from `packages/database` and `packages/domain` may fail.

Use Vercel's **Preview** environment for test deployments and **Production** for the real domain. Put a temporary test database in Preview if possible. Do not point Preview at production unless you understand the data and migration risks.

After the first deployment, open the deployment's **Functions** and **Logs** tabs. Visit both health URLs. Then test:

1. Register a test user.
2. Verify the email.
3. Create a company.
4. Complete onboarding.
5. Add a worker invitation.
6. Check inventory and receipt pages.
7. Confirm a user in one organization cannot see another organization's records.

If the deployment starts but readiness fails, inspect the Vercel logs. The most common causes are an incorrect `DATABASE_URL`, a database firewall rule, a missing `BETTER_AUTH_SECRET`, or an incorrect `BETTER_AUTH_URL`.

### Step 8 — connect and migrate the production database

Before migrating, make a backup or confirm that the RDS automated backup and snapshot policy are active. A migration changes the database schema; it is not just a read-only deploy.

For a one-time manual migration, run from a trusted machine with the production URL supplied only for that command:

```bash
DATABASE_URL='postgresql://supplai_app:URL_ENCODED_PASSWORD@RDS_ENDPOINT:5432/supplai?sslmode=require' \
  pnpm --filter @supply/database migrate:deploy
```

Check the result in the terminal. Prisma should report that migrations have been applied or that the database is already up to date. If it fails, do not delete the `_prisma_migrations` table and do not run `migrate dev` against production. Fix the connection or migration issue, then rerun the safe deployment command.

For future releases, the migration should run in a protected AWS task or Kubernetes Job. It should finish successfully before the application is updated when the application depends on a new table or column.

### Step 9 — use ECS as the interim worker option

This repository already contains ECS task definitions. ECS is not Kubernetes, but it is a reasonable first production runtime while learning AWS.

You need:

- an ECS cluster;
- a Fargate task execution role;
- a task role if the application calls AWS services;
- a private subnet and security group;
- a CloudWatch log group;
- the ECR image URI;
- the database secret ARN for the migration task.

Replace the placeholders in `backend/aws/ecs-task-definition.json` and `backend/aws/migration-task-definition.json`. Do not commit your filled-in private versions if they contain account-specific secret ARNs or credentials; use deployment-time substitution or a secret manager.

Create log groups before starting tasks:

```bash
aws logs create-log-group --log-group-name /ecs/supplai-backend
aws logs create-log-group --log-group-name /ecs/supplai-database-migration
```

Register the task definition, create the service, and wait for the task to become healthy in the ECS console. Open the task logs and verify that the container starts without a database error.

Do not expose port `3001` to the public internet. The worker's health endpoint should be reachable only by ECS health checks, internal monitoring, or an internal load balancer.

### Step 10 — create EKS when ready for Kubernetes

Kubernetes adds flexibility but also adds operational work. Do not begin with multiple microservices. Start by running only the existing backend worker.

Install and verify:

```bash
kubectl version --client
eksctl version
helm version
```

Create the cluster using a documented configuration file rather than an unexplained one-line command. At minimum, choose:

- the same AWS region as RDS;
- the existing VPC and private subnets;
- at least two Availability Zones;
- managed worker nodes or an approved serverless capacity option;
- a cluster name such as `supplai-production`.

After creation, connect your local `kubectl`:

```bash
aws eks update-kubeconfig \
  --region "$AWS_REGION" \
  --name supplai-production
kubectl get nodes
```

You should see the worker nodes in `Ready` state. If you see `Unauthorized`, your AWS identity does not have access to the cluster. If nodes are not ready, inspect the EKS console before deploying an application.

Create a namespace so Supplai resources are separated from system resources:

```bash
kubectl create namespace supplai
```

Create a service account for the worker and connect it to AWS permissions using EKS Pod Identity or IRSA. The worker should receive only the permissions it needs, such as reading its database secret. It should not have administrator access to the cluster or AWS account.

Store the database connection through the approved external-secret mechanism. A plain Kubernetes Secret is encoded, not automatically encrypted from every administrator, so do not treat base64 as security. The secret value should originate in AWS Secrets Manager.

Create a Deployment for the worker with:

- image `ECR_HOST/supplai-backend:git-COMMIT_SHA`;
- one replica initially;
- port `3001` only inside the cluster;
- `readinessProbe` at `/health/ready`;
- `livenessProbe` at `/health/live`;
- non-root user;
- CPU and memory requests and limits;
- a rolling update strategy.

Apply manifests from the repository:

```bash
kubectl apply -f infra/kubernetes/ -n supplai
kubectl rollout status deployment/supplai-backend -n supplai
kubectl get pods -n supplai
kubectl logs deployment/supplai-backend -n supplai
```

The `infra/kubernetes/` directory does not exist yet. Create it only when you are ready to add and review manifests. Keep values such as the AWS account ID, image tag, and secret references in a Helm values file, Kustomize overlay, or CD substitution step rather than hard-coding production values in a generic manifest.

For the migration, use a Kubernetes Job that runs the migration image once. Confirm that the Job completed before rolling out a new application version:

```bash
kubectl get jobs -n supplai
kubectl logs job/supplai-database-migration -n supplai
```

Do not create a CronJob for schema migrations. Migrations should run once per release, under deployment control.

### Step 11 — understand and extend CI

CI means “continuous integration”: every pull request is checked before merging. The existing workflow already runs:

```text
format check -> lint -> typecheck -> tests -> production build
```

Open `.github/workflows/ci.yml` and understand that it does not deploy anything. A green CI check means the code passed automated checks; it does not mean the code is live.

Keep the workflow on pull requests and pushes to `main`. In GitHub repository settings:

1. Open **Settings → Branches**.
2. Add a branch protection rule for `main`.
3. Require the CI job to pass.
4. Require pull requests and at least one review.
5. Prevent force pushes and direct unreviewed changes.

Before adding Docker builds, run them locally:

```bash
docker build -f backend/Dockerfile .
docker build -f backend/aws/migrations.Dockerfile .
```

Only after these succeed should you add them as CI steps. A failed Docker build should block a release because the deployment cannot start without a valid image.

### Step 12 — understand and build CD

CD means “continuous delivery/deployment”: approved code is packaged and sent to the cloud. Build this in stages rather than creating one large, hard-to-debug workflow.

Create these GitHub Environments:

- `staging`: automatic deployment is acceptable;
- `production`: require a human approval before migration and deployment.

First automate image publishing only. The workflow should check out the commit, log into AWS through OIDC, build both Docker images, tag them with the commit SHA, and push them to ECR. Confirm the images appear in ECR.

Next automate the migration as a separate ECS task. Add an explicit dependency so
the deployment job cannot start if migration fails. Protect this job with the
production environment approval.

The current production rollout is ECS-based. The deployment job should:

1. Configure AWS credentials through OIDC.
2. Build and push Linux/AMD64 images to ECR.
3. Substitute the exact commit image tag in ECS task definitions.
4. Run the migration task and wait for it to complete.
5. Register the frontend and backend ECS task definitions.
6. Update only the services affected by the commit.
7. Wait for ECS services to become stable.
8. Fail on timeout and preserve the previous task definition for rollback.
9. Run health and smoke tests.

If EKS is adopted later, replace the ECS rollout steps with the EKS Job and
Deployment steps described in the Kubernetes section. Do not deploy the same
worker to ECS and EKS at the same time unless duplicate processing has been
designed and tested.

Use an OIDC trust policy that permits only your GitHub repository and intended branch/environment. The workflow should not contain long-lived AWS access keys.

Vercel is not part of the current production path. If the frontend is moved to
Vercel later, connect the repository in Vercel and use Preview and Production
environments with separate databases and secrets. Do not run the same frontend
in ECS and Vercel without deciding which URL and deployment is authoritative.

### Step 13 — perform a release safely

For each release, use this checklist:

1. Create a branch for the change.
2. Run the full local validation commands.
3. Open a pull request.
4. Wait for CI and review.
5. Merge to `main`.
6. Confirm the commit SHA that CD is deploying.
7. Approve the staging migration and deployment.
8. Test the staging URL and health endpoints.
9. Review the database migration for destructive changes.
10. Take or verify the RDS backup.
11. Approve the production migration.
12. Approve the production deployment.
13. Watch ALB responses, ECS events/logs, worker logs, and RDS metrics.
14. Run the smoke-test checklist.
15. Record the release SHA and result.

Use backward-compatible database changes. For a rename, add the new column first, deploy code that writes both columns, backfill data, switch reads, and remove the old column in a later release. Avoid changing the database and old application in a way where either one temporarily becomes incompatible.

### Step 14 — know how to diagnose failures

**The Vercel build fails:** check the Vercel root directory, whether files outside the root are included, the Node/pnpm versions, and whether the lockfile is committed.

**Vercel readiness fails:** check `DATABASE_URL`, RDS security groups, TLS mode, and whether the database is reachable from the chosen Vercel connection path.

**Authentication links do not arrive:** check `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, domain verification, and the Vercel function logs.

**The Docker container exits:** inspect the image locally with `docker run`, then inspect ECS or EKS logs. Check the command, port, and required environment variables.

**EKS pods are `Pending`:** inspect `kubectl describe pod`. The cluster may lack capacity, have incorrect subnets, or have an invalid scheduling constraint.

**EKS pods are `CrashLoopBackOff`:** inspect logs and the previous container logs:

```bash
kubectl logs pod/REPLACE_ME -n supplai --previous
kubectl describe pod/REPLACE_ME -n supplai
```

**The migration fails:** do not delete migration history. Read the exact Prisma and PostgreSQL error, confirm the connection, and check whether the migration was partially applied. Use the database backup/recovery plan before making manual changes.

**The deployment is unhealthy after release:** stop increasing replicas. Roll back the application image to the previous known-good digest, check logs, and decide whether the issue is code, configuration, database compatibility, or infrastructure.

### Step 15 — monitoring and recovery

At minimum, create alerts for:

- Vercel function errors and elevated response times;
- failed or delayed authentication emails;
- RDS CPU, storage, connections, and free storage;
- worker restarts and failed readiness checks;
- failed migrations;
- EKS node capacity and unhealthy pods;
- AWS budget thresholds.

Test recovery before real customers depend on the system:

1. Restore an RDS snapshot into a separate test database.
2. Point a staging deployment at the restored database.
3. Confirm migrations and login work.
4. Confirm data and organization boundaries are intact.
5. Record how long recovery took and update the runbook.

Backups are not a recovery plan until you have successfully restored one.

## What to do first this week

If this is your first time doing cloud deployment, do not start with Kubernetes or automated production deployments. Follow this smaller sequence:

1. Run the application locally and complete the local checklist.
2. Create the AWS account security and budget safeguards.
3. Create the VPC and RDS database in a non-production or staging environment.
4. Deploy the frontend to a Vercel Preview environment.
5. Connect Preview to the staging database and run the complete user flow.
6. Build the backend Docker image and run it locally.
7. Run the backend on ECS as the first cloud worker.
8. Add staging CD and learn from one successful release.
9. Create EKS only after the ECS worker and deployment process are understood.
10. Move the worker from ECS to EKS and then automate the production rollout.

When something fails, record the command, the complete error message, the AWS/Vercel resource involved, and what changed immediately before the failure. That information is much more useful than repeatedly retrying the same command.
