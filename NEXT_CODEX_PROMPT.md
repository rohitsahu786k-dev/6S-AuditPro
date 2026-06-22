Continue the 6S AuditPro redevelopment from `REDEVELOPMENT_STATUS.md`.

Read `C:\Users\rohit.sahu\Downloads\6S AuditPro.docx` and `public/index.html` first. Preserve the current ONEPWS red branding, `public/favicon.png`, and `public/onepws-dark-logo-scaled.png`. Do not reintroduce blue as the app theme.

Continue the production redevelopment requested in the DOCX. The first Next.js buildable version now exists with:
- Next.js App Router + TypeScript
- MongoDB/Mongoose models
- secure auth with hashed passwords and HTTP-only JWT cookies
- role/permission enforcement via `proxy.ts`, APIs, and UI shell
- Cloudinary upload service
- SMTP/Nodemailer email system
- editable MongoDB-backed email templates and email logs
- partial audit, findings, CAPA, analytics, users, email, and admin workflows
- `.env.example`, README, seed script, Vercel deployment support

Update `REDEVELOPMENT_STATUS.md` continuously and do not mark any feature DONE unless implemented and verified.
