# Security Recommendations

## Token Encryption at Rest

### Current State

OAuth tokens (Strava access tokens, refresh tokens) are currently stored in plaintext in the `strava_connections` table. While Supabase provides encryption at the infrastructure level, implementing application-level encryption provides defense-in-depth.

### Recommendation: Use Supabase Vault

Supabase provides a built-in encrypted storage solution called **Vault** for sensitive data like API tokens.

### Implementation Steps

#### 1. Enable Supabase Vault

```sql
-- Enable the Vault extension (run once)
CREATE EXTENSION IF NOT EXISTS pgsodium;
```

#### 2. Create Vault Secrets Table

```sql
-- Migration: Enable Vault for tokens
CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  secret text NOT NULL
);

-- Grant access to authenticated users
GRANT SELECT ON vault.secrets TO authenticated;
```

#### 3. Migrate Existing Tokens

```sql
-- Migration: Move tokens to encrypted storage
DO $$
DECLARE
  conn RECORD;
BEGIN
  FOR conn IN SELECT id, user_id, access_token, refresh_token FROM public.strava_connections LOOP
    -- Store access token in vault
    INSERT INTO vault.secrets (name, secret)
    VALUES (
      'strava_access_' || conn.user_id,
      conn.access_token
    )
    ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

    -- Store refresh token in vault
    INSERT INTO vault.secrets (name, secret)
    VALUES (
      'strava_refresh_' || conn.user_id,
      conn.refresh_token
    )
    ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
  END LOOP;
END $$;

-- Remove plaintext tokens from connections table
ALTER TABLE public.strava_connections
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;
```

#### 4. Update Application Code

**Before (current):**

```typescript
// Retrieve tokens directly from strava_connections
const { data } = await supabase
  .from('strava_connections')
  .select('access_token, refresh_token')
  .eq('user_id', userId)
  .single()

const accessToken = data.access_token
```

**After (with Vault):**

```typescript
// Retrieve tokens from encrypted vault
const { data: accessTokenData } = await supabase
  .from('vault.secrets')
  .select('secret')
  .eq('name', `strava_access_${userId}`)
  .single()

const accessToken = accessTokenData.secret
```

#### 5. Update Token Storage

**Store new tokens in vault:**

```typescript
async function storeTokens(userId: string, accessToken: string, refreshToken: string) {
  // Store access token
  await supabase.from('vault.secrets').upsert({
    name: `strava_access_${userId}`,
    secret: accessToken,
  })

  // Store refresh token
  await supabase.from('vault.secrets').upsert({
    name: `strava_refresh_${userId}`,
    secret: refreshToken,
  })

  // Update connection metadata (without tokens)
  await supabase
    .from('strava_connections')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}
```

### Benefits

1. **Encryption at Rest**: Tokens encrypted using pgsodium (libsodium)
2. **Automatic Key Management**: Supabase manages encryption keys
3. **Defense in Depth**: Additional layer beyond infrastructure encryption
4. **Audit Trail**: Vault access can be logged
5. **Compliance**: Meets PCI DSS, HIPAA requirements

### Performance Considerations

- **Minimal Overhead**: pgsodium encryption is fast (~1-2ms per operation)
- **Connection Pooling**: Use connection pooling to minimize latency
- **Caching**: Consider caching decrypted tokens for the duration of a request

### Alternative: Client-Side Encryption

For maximum security, encrypt tokens client-side before storing:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY! // 32 bytes

function encryptToken(token: string): { encrypted: string; iv: string } {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return {
    encrypted: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex'),
  }
}

function decryptToken(encrypted: string, iv: string): string {
  const authTag = Buffer.from(encrypted.slice(-32), 'hex')
  const encryptedData = encrypted.slice(0, -32)

  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  )
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

**Note:** Requires secure key management (use environment variables, never commit to git)

## Other Security Recommendations

### 1. Environment Variables

**Always use environment variables for sensitive data:**

```bash
# .env.local (NEVER commit this file)
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=random_secure_token
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TOKEN_ENCRYPTION_KEY=64_char_hex_string
```

### 2. HTTPS Only

**Ensure all API calls use HTTPS:**

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Redirect HTTP to HTTPS in production
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    return NextResponse.redirect(
      `https://${request.headers.get('host')}${request.nextUrl.pathname}`,
      301
    )
  }
}
```

### 3. Content Security Policy

**Add CSP headers to prevent XSS:**

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]
```

### 4. Rate Limiting

**Already implemented** (see `lib/rate-limit.ts`)

Rate limiting prevents brute-force attacks and API abuse.

### 5. Input Validation

**Always validate user input:**

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const result = schema.safeParse(input)
if (!result.success) {
  return { error: result.error }
}
```

### 6. SQL Injection Prevention

**Use parameterized queries (Supabase does this automatically):**

```typescript
// SAFE - Supabase uses parameterized queries
await supabase.from('users').select('*').eq('email', userEmail) // Automatically sanitized

// NEVER do this:
await supabase.rpc('raw_sql', {
  query: `SELECT * FROM users WHERE email = '${userEmail}'`,
}) // Vulnerable to SQL injection!
```

### 7. Dependency Audits

**Regularly audit dependencies:**

```bash
# Check for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit --fix

# Update dependencies
pnpm update --latest
```

## Incident Response Plan

### If Tokens Are Compromised

1. **Immediately revoke all tokens:**

   ```sql
   DELETE FROM vault.secrets WHERE name LIKE 'strava_%';
   DELETE FROM strava_connections;
   ```

2. **Notify affected users**
3. **Force re-authentication**
4. **Review access logs** for suspicious activity
5. **Rotate encryption keys** (if using custom encryption)
6. **Update Strava application** to regenerate client secret

### Monitoring

- Set up alerts for failed authentication attempts
- Monitor for unusual API usage patterns
- Log all token access (but not the tokens themselves)
- Regular security audits

## Compliance

### GDPR

- Users can request data deletion
- Implement data export functionality
- Clear privacy policy
- Cookie consent for tracking

### PCI DSS

- No credit card data stored (payment handled by Strava)
- Tokens encrypted at rest
- Secure transmission (HTTPS)
- Access controls implemented

## References

- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [pgsodium Documentation](https://github.com/michelp/pgsodium)

## Status

**Current Implementation:**

- ✅ Rate limiting
- ✅ Input validation
- ✅ Environment variables
- ✅ HTTPS enforcement (in production)
- ❌ Token encryption (plaintext storage)

**Recommended Next Steps:**

1. Implement Supabase Vault for token encryption
2. Add security headers (CSP, HSTS)
3. Set up automated dependency audits
4. Implement audit logging
5. Add security monitoring/alerting
