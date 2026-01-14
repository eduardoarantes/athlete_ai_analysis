# Email Template Preview Files

These HTML files allow you to preview the email templates in your browser without sending actual emails.

## Quick Preview

Open these files directly in your browser:

```bash
# Password Reset Email
open web/docs/email-templates/preview/password-reset.html

# Signup Confirmation Email
open web/docs/email-templates/preview/signup-confirmation.html
```

## What's Different from Production Templates

These preview files replace Supabase variables with example values:

| Supabase Variable        | Preview Value                                                   |
| ------------------------ | --------------------------------------------------------------- |
| `{{ .ConfirmationURL }}` | `http://localhost:3000/reset-password?token=example-token-here` |
| Links won't work         | They're just for visual preview                                 |

## Testing Responsiveness

1. **Desktop view:**
   - Open in Chrome, Firefox, Safari
   - Check gradient rendering
   - Verify button styling

2. **Mobile view:**
   - Open browser DevTools (F12)
   - Toggle device toolbar
   - Test at 320px, 375px, 414px widths

3. **Dark mode:**
   - Enable dark mode in your OS
   - Reload the HTML files
   - Check text readability

## For Real Email Testing

To test actual email delivery:

1. **Use the cloud Supabase project:**
   - Go to https://app.supabase.com/project/yqaskiwzyhhovthbvmqq
   - Paste templates in Authentication → Email Templates
   - Test the flows in your local app

2. **Or use a local email testing tool:**
   - See `web/docs/email-templates/supabase-email-templates.md` for options

## Files in This Directory

- `password-reset.html` - Password reset email preview
- `signup-confirmation.html` - Signup confirmation email preview
- `README.md` - This file
