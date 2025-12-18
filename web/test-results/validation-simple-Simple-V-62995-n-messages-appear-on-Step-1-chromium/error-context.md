# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: Welcome back
      - generic [ref=e6]: Sign in to your Cycling AI account
    - generic [ref=e7]:
      - generic [ref=e8]:
        - alert [ref=e9]:
          - generic [ref=e10]: Invalid login credentials
        - generic [ref=e11]:
          - generic [ref=e12]: Email
          - textbox "Email" [ref=e13]:
            - /placeholder: you@example.com
            - text: validation-simple-1766032905503@example.com
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: Password
            - link "Forgot password?" [ref=e17] [cursor=pointer]:
              - /url: /forgot-password/
          - textbox "Password" [ref=e18]:
            - /placeholder: ••••••••
            - text: TestPassword123!
        - button "Sign in" [ref=e19]
      - paragraph [ref=e20]:
        - text: Don't have an account?
        - link "Sign up" [ref=e21] [cursor=pointer]:
          - /url: /signup/
  - button "Open Next.js Dev Tools" [ref=e27] [cursor=pointer]:
    - img [ref=e28]
  - alert [ref=e31]
```