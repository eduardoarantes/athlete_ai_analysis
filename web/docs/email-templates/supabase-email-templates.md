# Supabase Email Templates - Cycling AI Analysis

> **Last Updated:** 2026-01-13
> **Issue:** #120 - Customize the recover password email from Supabase

This document contains the HTML email templates for Supabase authentication emails, including marketing copy that encourages and congratulates users.

---

## Table of Contents

1. [Password Reset Email](#1-password-reset-email)
2. [Signup Confirmation Email](#2-signup-confirmation-email)
3. [Implementation Instructions](#implementation-instructions)
4. [Testing Checklist](#testing-checklist)

---

## 1. Password Reset Email

**Purpose:** Help users reset their password with a supportive, encouraging tone.

**Tone:** Supportive, helpful, professional with gentle encouragement.

**Template Name in Supabase:** `Reset Password`

### HTML Template

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password - Cycling AI Analysis</title>
  </head>
  <body
    style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;"
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background-color: #f5f5f5; padding: 40px 20px;"
    >
      <tr>
        <td align="center">
          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
          >
            <!-- Header -->
            <tr>
              <td
                style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 40px 30px; text-align: center; border-radius: 8px 8px 0 0;"
              >
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                  🚴 Cycling AI Analysis
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 40px;">
                <!-- Main Heading -->
                <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px; font-weight: 600;">
                  Reset Your Password
                </h2>

                <!-- Body Text -->
                <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                  Hi there,
                </p>

                <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                  We received a request to reset your password. Don't worry—this happens to the best
                  of us! Click the button below to create a new password and get back to your
                  training.
                </p>

                <!-- CTA Button -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                  <tr>
                    <td align="center">
                      <a
                        href="{{ .ConfirmationURL }}"
                        style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);"
                      >
                        Reset My Password
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Encouragement -->
                <div
                  style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; margin: 30px 0; border-radius: 4px;"
                >
                  <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
                    <strong style="color: #1e293b;">💪 Keep pushing forward!</strong><br />
                    We're here to support your cycling journey every step of the way. Your training
                    progress is waiting for you.
                  </p>
                </div>

                <!-- Security Note -->
                <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                  <strong>For your security:</strong> This link expires in 60 minutes. If you didn't
                  request this password reset, you can safely ignore this email—your account remains
                  secure.
                </p>

                <!-- Alternative Link -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px; color: #64748b; font-size: 13px;">
                    Button not working? Copy and paste this URL into your browser:
                  </p>
                  <p style="margin: 0; word-break: break-all;">
                    <a
                      href="{{ .ConfirmationURL }}"
                      style="color: #3b82f6; text-decoration: none; font-size: 13px;"
                    >
                      {{ .ConfirmationURL }}
                    </a>
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;"
              >
                <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                  <strong>Cycling AI Analysis</strong><br />
                  Your AI-powered cycling coach
                </p>
                <p style="margin: 10px 0 0; color: #94a3b8; font-size: 13px;">
                  Need help? Contact us at
                  <a
                    href="mailto:support@cyclingai.example.com"
                    style="color: #3b82f6; text-decoration: none;"
                    >support@cyclingai.example.com</a
                  >
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Signup Confirmation Email

**Purpose:** Welcome new users and congratulate them on starting their cycling journey.

**Tone:** Enthusiastic, welcoming, motivational with genuine excitement.

**Template Name in Supabase:** `Confirm Signup`

### HTML Template

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Cycling AI Analysis!</title>
  </head>
  <body
    style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;"
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background-color: #f5f5f5; padding: 40px 20px;"
    >
      <tr>
        <td align="center">
          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
          >
            <!-- Header with Celebration -->
            <tr>
              <td
                style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center; border-radius: 8px 8px 0 0;"
              >
                <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                  Welcome to Cycling AI Analysis!
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 40px;">
                <!-- Congratulations Message -->
                <div
                  style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 8px; padding: 24px; margin-bottom: 30px; text-align: center;"
                >
                  <h2 style="margin: 0 0 12px; color: #1e40af; font-size: 22px; font-weight: 700;">
                    🚴 Congratulations on Taking the First Step!
                  </h2>
                  <p style="margin: 0; color: #1e40af; font-size: 16px; line-height: 1.5;">
                    You're about to unlock AI-powered insights that will transform your cycling
                    performance.
                  </p>
                </div>

                <!-- Main Message -->
                <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                  Hi there,
                </p>

                <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                  We're thrilled to have you join our community of passionate cyclists! You've just
                  taken an important step toward smarter, more effective training.
                </p>

                <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                  To get started, please confirm your email address by clicking the button below:
                </p>

                <!-- CTA Button -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                  <tr>
                    <td align="center">
                      <a
                        href="{{ .ConfirmationURL }}"
                        style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);"
                      >
                        Confirm Email & Start Your Journey
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- What's Next Section -->
                <div
                  style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 4px;"
                >
                  <h3 style="margin: 0 0 12px; color: #92400e; font-size: 18px; font-weight: 600;">
                    🎯 What's Waiting for You:
                  </h3>
                  <ul
                    style="margin: 0; padding-left: 20px; color: #78350f; font-size: 15px; line-height: 1.8;"
                  >
                    <li>
                      <strong>Personalized Training Plans</strong> – AI-generated workouts tailored
                      to your goals
                    </li>
                    <li>
                      <strong>Performance Analytics</strong> – Deep insights into your cycling data
                    </li>
                    <li>
                      <strong>Power Zone Training</strong> – Optimize your training with precision
                    </li>
                    <li>
                      <strong>Progress Tracking</strong> – Watch yourself improve week after week
                    </li>
                  </ul>
                </div>

                <!-- Motivational Message -->
                <div
                  style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;"
                >
                  <p
                    style="margin: 0; color: #1e293b; font-size: 17px; line-height: 1.6; font-weight: 500;"
                  >
                    💪 "Every champion was once a beginner who refused to give up."
                  </p>
                  <p style="margin: 12px 0 0; color: #64748b; font-size: 15px;">
                    Your journey to becoming a stronger cyclist starts now. We're with you every
                    pedal stroke of the way!
                  </p>
                </div>

                <!-- Security Note -->
                <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                  <strong>Note:</strong> This confirmation link expires in 24 hours. If you didn't
                  create this account, you can safely ignore this email.
                </p>

                <!-- Alternative Link -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px; color: #64748b; font-size: 13px;">
                    Button not working? Copy and paste this URL into your browser:
                  </p>
                  <p style="margin: 0; word-break: break-all;">
                    <a
                      href="{{ .ConfirmationURL }}"
                      style="color: #10b981; text-decoration: none; font-size: 13px;"
                    >
                      {{ .ConfirmationURL }}
                    </a>
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;"
              >
                <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                  <strong>🚴 Cycling AI Analysis</strong><br />
                  Your AI-powered cycling coach
                </p>
                <p style="margin: 10px 0 0; color: #94a3b8; font-size: 13px;">
                  Questions? We're here to help! Reach out at
                  <a
                    href="mailto:support@cyclingai.example.com"
                    style="color: #10b981; text-decoration: none;"
                    >support@cyclingai.example.com</a
                  >
                </p>
                <p style="margin: 15px 0 0; color: #94a3b8; font-size: 13px;">
                  Follow your passion. Track your progress. Achieve your goals.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## Implementation Instructions

### Step 1: Access Supabase Dashboard

1. Navigate to your Supabase project dashboard
2. Go to **Authentication** → **Email Templates** in the left sidebar

### Step 2: Configure Reset Password Email

1. Select **"Reset Password"** template
2. **Subject:** `Reset Your Password - Cycling AI Analysis`
3. Copy and paste the **Password Reset Email HTML** from above into the template editor
4. Click **Save**

### Step 3: Configure Signup Confirmation Email

1. Select **"Confirm Signup"** template
2. **Subject:** `Welcome to Cycling AI Analysis! 🎉 Please Confirm Your Email`
3. Copy and paste the **Signup Confirmation Email HTML** from above into the template editor
4. Click **Save**

### Step 4: Update Support Email (Optional)

Both templates reference `support@cyclingai.example.com`. Update this to your actual support email address:

- Search for `support@cyclingai.example.com` in both templates
- Replace with your real support email

---

## Testing Checklist

### Password Reset Email

- [ ] Trigger password reset from `/forgot-password` page
- [ ] Verify email is received within 1-2 minutes
- [ ] Check email renders correctly in:
  - [ ] Gmail (web)
  - [ ] Gmail (mobile app)
  - [ ] Apple Mail (macOS)
  - [ ] Apple Mail (iOS)
  - [ ] Outlook (web)
  - [ ] Outlook (desktop)
- [ ] Click "Reset My Password" button
- [ ] Verify redirect to `/reset-password` page
- [ ] Complete password reset successfully
- [ ] Verify old password no longer works
- [ ] Test fallback link (copy/paste URL)
- [ ] Verify link expires after 60 minutes

### Signup Confirmation Email

- [ ] Create new account from `/signup` page
- [ ] Verify confirmation email is received (if email confirmation is enabled)
- [ ] Check email renders correctly in all major clients (see list above)
- [ ] Click "Confirm Email & Start Your Journey" button
- [ ] Verify redirect to dashboard or onboarding
- [ ] Verify account is activated
- [ ] Test fallback link (copy/paste URL)
- [ ] Verify link expires after 24 hours

### Cross-Client Compatibility

- [ ] All images/emojis display correctly
- [ ] Button styling is preserved
- [ ] Gradient backgrounds render (or fallback gracefully)
- [ ] Responsive design works on mobile
- [ ] No broken layouts in table-based clients
- [ ] Links are clickable and properly formatted

### Accessibility

- [ ] Color contrast meets WCAG AA standards
- [ ] Text is readable without images
- [ ] Links have descriptive text
- [ ] Alt text provided for decorative elements

---

## Supabase Variables Reference

These variables are automatically populated by Supabase:

| Variable                 | Description                          | Used In                                |
| ------------------------ | ------------------------------------ | -------------------------------------- |
| `{{ .ConfirmationURL }}` | Confirmation/reset link with token   | Both templates                         |
| `{{ .Email }}`           | User's email address                 | Optional (not used in these templates) |
| `{{ .Token }}`           | Raw confirmation token               | Optional (URL construction)            |
| `{{ .TokenHash }}`       | Hashed token                         | Optional (URL construction)            |
| `{{ .SiteURL }}`         | Your site URL from Supabase settings | Optional (URL construction)            |

---

## Design Principles

### 1. **Tone & Voice**

- **Password Reset:** Supportive, helpful, professional with gentle encouragement
- **Signup:** Enthusiastic, welcoming, motivational with genuine excitement

### 2. **Marketing Copy Guidelines**

- **Congratulate and encourage** – Make users feel welcomed and supported
- **Highlight value** – Show what they gain from the platform
- **Build excitement** – Create anticipation for their journey
- **Be genuine** – Avoid corporate/generic language
- **Stay focused** – Don't overshadow the primary action (confirm email, reset password)

### 3. **Visual Design**

- **Color coding:** Blue for password reset (calm, trustworthy), Green for signup (growth, success)
- **Clear CTAs:** Large, prominent buttons with action-oriented text
- **Hierarchy:** Important information stands out
- **White space:** Generous padding prevents overwhelming users

### 4. **Email Compatibility**

- **Table-based layout:** Maximum compatibility with older email clients
- **Inline CSS:** Styles are preserved across all clients
- **Gradient fallbacks:** Gradients degrade gracefully in unsupported clients
- **Mobile responsive:** Readable on all screen sizes

---

## Support & Resources

- **Supabase Email Templates Docs:** https://supabase.com/docs/guides/auth/auth-email-templates
- **Email Testing Tools:**
  - [Litmus](https://litmus.com/) – Email client testing
  - [Email on Acid](https://www.emailonacid.com/) – Cross-client preview
  - [Mailtrap](https://mailtrap.io/) – Email testing in development
- **HTML Email Best Practices:** https://www.campaignmonitor.com/css/

---

## Changelog

| Date       | Author  | Changes                                              |
| ---------- | ------- | ---------------------------------------------------- |
| 2026-01-13 | Initial | Created templates with marketing copy for Issue #120 |

---

**Next Steps:**

1. Review templates with stakeholders
2. Update support email addresses
3. Implement in Supabase Dashboard
4. Test both email flows end-to-end
5. Monitor email delivery rates
6. Gather user feedback on email content
