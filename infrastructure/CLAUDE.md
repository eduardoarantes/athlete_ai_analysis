# Infrastructure Guidelines

## AWS Resource Naming Convention

All AWS resources MUST be environment-specific. Use a prefix/base name combined with an environment identifier.

### Pattern

```
{resource-prefix}-{environment}
```

### Environment Identifiers

| Environment | Identifier |
|-------------|------------|
| Development | `dev` |
| Staging | `staging` |
| Production | `prod` |

### Environment Variables

Use placeholders instead of hardcoding full resource names:

```bash
# Base configuration (same across all environments)
AWS_S3_BUCKET_PREFIX=athlete-ai-note-attachments
AWS_S3_REGION=us-east-1

# Environment identifier (set per deployment)
APP_ENV=dev  # dev | staging | prod
```

### Resource Name Resolution

Resolve resource names dynamically in code:

```typescript
const bucketName = `${process.env.AWS_S3_BUCKET_PREFIX}-${process.env.APP_ENV}`
// Results in: athlete-ai-note-attachments-dev, athlete-ai-note-attachments-staging, etc.
```

### Examples

| Resource Type | Prefix | Dev | Staging | Prod |
|---------------|--------|-----|---------|------|
| S3 Bucket | `athlete-ai-note-attachments` | `athlete-ai-note-attachments-dev` | `athlete-ai-note-attachments-staging` | `athlete-ai-note-attachments-prod` |
| IAM Role | `athlete-ai-app-role` | `athlete-ai-app-role-dev` | `athlete-ai-app-role-staging` | `athlete-ai-app-role-prod` |

### CORS Origins

Configure allowed origins per environment:

| Environment | Allowed Origin |
|-------------|----------------|
| Development | `http://localhost:3000` |
| Staging | `https://staging.athlete-ai.com` |
| Production | `https://athlete-ai.com` |

### Benefits

1. **Isolation** - Each environment has separate resources
2. **Safety** - No accidental cross-environment data access
3. **Flexibility** - Easy to add new environments
4. **Consistency** - Single source of truth for naming
