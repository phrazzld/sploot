# Setting up Clerk Authentication for Sploot

## Quick Setup Guide

1. **Create a Clerk account**
   - Go to [clerk.com](https://clerk.com) and sign up
   - Create a new application

2. **Configure authentication methods**
   In your Clerk Dashboard, enable these sign-in methods:
   - ✅ Google OAuth
   - ✅ Apple OAuth (requires Apple Developer account)
   - ✅ Email Magic Link
   - Optional: Email/Password as fallback

3. **Get your API keys**
   From the Clerk Dashboard → API Keys:
   - Copy your **Publishable Key** (starts with `pk_`)
   - Copy your **Secret Key** (starts with `sk_`)

4. **Update environment variables**
   Edit `.env.local` and replace the placeholder values:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_key_here
   ```

5. **Configure redirect URLs** (already set in .env.local)
   - Sign in URL: `/sign-in`
   - Sign up URL: `/sign-up`
   - After sign in/up URL: `/app`

6. **Test authentication**
   ```bash
   pnpm dev
   ```
   - Visit http://localhost:3000
   - Click "Get Started" or "Sign In"
   - Try signing up with Google or email magic link

## Production Setup

For production deployment on Vercel:

1. Add the same environment variables to your Vercel project settings
2. Update Clerk's production instance with your production domain
3. Configure allowed redirect URLs in Clerk Dashboard

## Troubleshooting

- **"Missing API keys" error**: Ensure `.env.local` has valid keys
- **Redirect loops**: Check middleware.ts route matchers
- **OAuth not working**: Verify OAuth providers are enabled in Clerk Dashboard
- **Sessions not persisting**: Ensure cookies are enabled and same-site settings are correct