# Frontend deployment — AWS ECS Fargate

The frontend is a full-stack Next.js application. Its server-rendered pages,
Better Auth handler, database access, API routes, Gemini OCR, and Resend email
delivery all run inside the ECS frontend task. It is not deployed to Vercel in
the current production architecture.

Production URL: `https://supplai-pilot.com`

## Required AWS resources

- ECR repository: `supplai-frontend`
- ECS cluster: `supplai-production`
- ECS service: `supplai-frontend`
- Task-definition template: `backend/aws/frontend-task-definition.json`
- Private RDS connection secret: `supplai/production/database-url`
- Better Auth secret: `supplai/production/better-auth-secret`
- Resend API key: `supplai/production/resend-api-key`
- Gemini API key: `supplai/production/gemini-api-key`
- Public Application Load Balancer forwarding to port `3000`

## Build the image

Build for ECS's AMD64 runtime, even when building on an Apple Silicon Mac:

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=439777529311
export FRONTEND_TAG=$(git rev-parse --short=12 HEAD)-$(date +%Y%m%d%H%M%S)
export ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker buildx build \
  --platform linux/amd64 \
  --file frontend/Dockerfile \
  --tag "$ECR_REGISTRY/supplai-frontend:$FRONTEND_TAG" \
  --push \
  .
```

The Dockerfile generates and copies Prisma's Linux query engine into the
standalone Next.js image. Do not deploy an image built only for `arm64`.

## Register a task definition

The task-definition template contains placeholders and never contains secret
values. Retrieve secret ARNs from Secrets Manager, replace the placeholders,
and register a new immutable revision:

```bash
export DATABASE_URL_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id supplai/production/database-url \
  --region "$AWS_REGION" --query ARN --output text)
export BETTER_AUTH_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id supplai/production/better-auth-secret \
  --region "$AWS_REGION" --query ARN --output text)
export RESEND_API_KEY_ARN=$(aws secretsmanager describe-secret \
  --secret-id supplai/production/resend-api-key \
  --region "$AWS_REGION" --query ARN --output text)
export GEMINI_API_KEY_ARN=$(aws secretsmanager describe-secret \
  --secret-id supplai/production/gemini-api-key \
  --region "$AWS_REGION" --query ARN --output text)
export AUTH_EMAIL_FROM='Supplai <no-reply@supplai-pilot.com>'

sed \
  -e "s|<AWS_ACCOUNT_ID>|$AWS_ACCOUNT_ID|g" \
  -e "s|<AWS_REGION>|$AWS_REGION|g" \
  -e "s|<IMAGE_TAG>|$FRONTEND_TAG|g" \
  -e "s|<DATABASE_URL_SECRET_ARN>|$DATABASE_URL_SECRET_ARN|g" \
  -e "s|<BETTER_AUTH_SECRET_ARN>|$BETTER_AUTH_SECRET_ARN|g" \
  -e "s|<RESEND_API_KEY_ARN>|$RESEND_API_KEY_ARN|g" \
  -e "s|<GEMINI_API_KEY_ARN>|$GEMINI_API_KEY_ARN|g" \
  -e "s|http://REPLACE_WITH_LOAD_BALANCER_URL|https://supplai-pilot.com|g" \
  -e "s|REPLACE_WITH_AUTH_EMAIL_FROM|$AUTH_EMAIL_FROM|g" \
  backend/aws/frontend-task-definition.json \
  > /tmp/supplai-frontend-task-definition.json

aws ecs register-task-definition \
  --cli-input-json file:///tmp/supplai-frontend-task-definition.json \
  --region "$AWS_REGION"
```

Check that `valueFrom` contains ARNs and that no `<...>` placeholders remain.
Never put a secret value in the JSON file or commit the generated file.

## Deploy the service

```bash
export FRONTEND_TASK_DEFINITION=$(aws ecs describe-task-definition \
  --task-definition supplai-frontend \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' --output text)

aws ecs update-service \
  --cluster supplai-production \
  --service supplai-frontend \
  --task-definition "$FRONTEND_TASK_DEFINITION" \
  --force-new-deployment \
  --region "$AWS_REGION"

aws ecs wait services-stable \
  --cluster supplai-production \
  --services supplai-frontend \
  --region "$AWS_REGION"
```

Verify the ALB target is healthy before testing the website:

```bash
aws elbv2 describe-target-health \
  --target-group-arn "$TARGET_GROUP_ARN" \
  --region "$AWS_REGION" \
  --output table
```

## Troubleshooting

View frontend logs:

```bash
aws logs tail /ecs/supplai-frontend --since 30m --follow --region us-east-1
```

Common causes:

- `CannotPullContainerError`: the ECR image tag is missing or has the wrong architecture.
- Prisma query-engine errors: rebuild with `--platform linux/amd64` using the checked-in Dockerfile.
- Resend errors: verify the domain and use a sender at `supplai-pilot.com`.
- Gemini `503`: check the configured primary and fallback models and the Gemini quota.
- Unhealthy target: inspect `/api/health/ready` and confirm RDS access.

## Automate future deployments

The repository's `.github/workflows/ci.yml` contains the production deployment
job. Once its AWS role is configured, the normal release process is:

1. Create a branch and open a pull request.
2. Wait for the validation checks to pass.
3. Merge the pull request into `main`.
4. Open GitHub's **Actions** tab and select the **CI** run.
5. Watch the **Deploy to AWS ECS** job.
6. Test `https://supplai-pilot.com` after both ECS services become stable.

The workflow uses the dedicated IAM user's `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` repository secrets. Do not add database passwords, API
keys, or generated task-definition files to GitHub. Rotate the IAM access key
periodically and keep its permissions limited to deployment operations.

The first-time AWS/GitHub setup is documented in the root README under
**Automatic deployment**. Production deployment is intentionally attached to
`main`: a pull request can build and validate the application without changing
production.
