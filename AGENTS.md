# AWS Guidance

- Prefer the AWS MCP Server for AWS interactions - it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the AWS CLI
  directly.
- Before starting a task, check whether a relevant AWS skill is available.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, or error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use hyphens
  instead.

## Secret safety

- Load the `aws-secrets-manager` skill first for any secret, credential, API
  key, token, or password task.
- Do not call `secretsmanager get-secret-value` or
  `batch-get-secret-value`, and do not access the Secrets Manager Agent daemon
  directly.
- Use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with `asm-exec`
  so the secret resolves at runtime without entering agent context.
