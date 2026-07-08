# 6S AuditPro - OnePWS Private Limited

Modern Next.js redevelopment of the 6S AuditPro Firebase/static app.

## Current Stack

- Next.js App Router + TypeScript
- MongoDB with Mongoose
- NextAuth.js (Credentials provider) authentication
- Role and permission guards
- Cloudinary server-side uploads
- Nodemailer SMTP email sending
- MongoDB-backed email templates and email logs
- OnePWS red branding with logo and favicon

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill values:

```bash
MONGODB_URI=
NEXTAUTH_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=
SMTP_USER=
SMTP_APP_PASSWORD=
SMTP_FROM_EMAIL=
SEED_ADMIN_PASSWORD=
```

3. Seed master data, default email templates, and first Master Admin:

```bash
npm run seed
```

4. Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## Vercel Deployment

1. Create a MongoDB Atlas cluster and add `MONGODB_URI`.
2. Create Cloudinary API credentials and add the Cloudinary variables.
3. Create an SMTP app password and add SMTP variables.
4. Add all `.env.example` variables in Vercel Project Settings.
5. Deploy the repo to Vercel.
6. Run the seed script once with `SEED_ADMIN_PASSWORD` configured.

## Security Notes

- Secrets are read only from server-side environment variables.
- Passwords are hashed with bcrypt.
- Auth is stored in HTTP-only cookies.
- API routes validate inputs with Zod and check permissions server-side.
- Uploads validate image type and size before Cloudinary upload.
- Email failures are logged and do not block main workflow actions.

## Known Remaining Work

See `REDEVELOPMENT_STATUS.md` for the complete feature-parity status and next steps.
