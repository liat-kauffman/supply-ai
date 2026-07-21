# Backend deployment — AWS

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
