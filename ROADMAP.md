# Aura Knot Photography – Development Roadmap

## Phase 1: Core Infrastructure (COMPLETED ✅)
- [x] Next.js 14 project setup with TypeScript & Tailwind
- [x] Database schema design (User, Job, Report models)
- [x] NextAuth.js authentication configuration
- [x] API route structure for jobs and dashboard
- [x] Frontend pages and responsive UI components
- [x] OTP-based login flow (UI complete, SMS pending)

---

## Phase 2: Database Integration (NEXT PRIORITY 🔴)

### Step 1: Set Up PostgreSQL Database
- [ ] Choose hosting (Supabase, AWS RDS, or local PostgreSQL)
- [ ] Create database and user credentials
- [ ] Update `.env.local` with `DATABASE_URL`
- [ ] Run: `npx prisma migrate dev --name init`
- [ ] Verify schema created in database

**Time Estimate:** 15-30 minutes

### Step 2: Connect Frontend to Backend
- [ ] Replace hardcoded `'temp-user-id'` in API calls with real session user
- [ ] Test job creation through UI
- [ ] Verify data persists in database
- [ ] Test update/delete operations
- [ ] Fix any API errors or validation issues

**Time Estimate:** 30-45 minutes

### Step 3: Implement Auth Middleware
- [ ] Create middleware to verify user session on protected routes
- [ ] Protect `/dashboard`, `/jobs/*`, `/reports` pages
- [ ] Add redirect to login for unauthorized access
- [ ] Test session persistence across page refreshes

**Time Estimate:** 20-30 minutes

---

## Phase 3: SMS/OTP Integration (MEDIUM PRIORITY 🟡)

### Option A: Twilio (Recommended)
```bash
npm install twilio
```

**Setup Steps:**
1. [ ] Sign up at twilio.com
2. [ ] Get Account SID, Auth Token, Phone Number
3. [ ] Add credentials to `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_PHONE_NUMBER=
   ```
4. [ ] Update `src/lib/auth-service.ts`:
   ```typescript
   import twilio from 'twilio';
   // Add sendSMS() function
   ```
5. [ ] Test OTP delivery

**Time Estimate:** 30-45 minutes

### Option B: Firebase Authentication
1. [ ] Set up Firebase project
2. [ ] Configure Phone Sign-In
3. [ ] Update NextAuth to use Firebase provider
4. [ ] Test OTP flow

**Time Estimate:** 45-60 minutes

---

## Phase 4: Advanced Features (LOWER PRIORITY 🟢)

### Job Management Enhancement
- [ ] Add Edit Job button and modal form
- [ ] Add Delete Job with confirmation
- [ ] Implement pagination for job lists
- [ ] Add search and filtering (by date, status, category)

**Time Estimate:** 1-2 hours

### Real Report Generation
- [ ] Query database instead of mock data
- [ ] Implement monthly/yearly calculations
- [ ] Add charts/visualizations (optional: Chart.js, Recharts)
- [ ] Test PDF/Excel export with real data

**Time Estimate:** 2-3 hours

### Payment Reminders
- [ ] Add reminder notifications for overdue payments
- [ ] Email integration (Nodemailer)
- [ ] Dashboard alert badges

**Time Estimate:** 1-2 hours

### Analytics Dashboard
- [ ] Add income trend charts
- [ ] Category-wise comparison
- [ ] Monthly revenue projections

**Time Estimate:** 2-3 hours

---

## Phase 5: Deployment (FINAL STAGE 🚀)

### Option A: Vercel (Easiest)
```bash
npm install -g vercel
vercel
```

**Setup Steps:**
1. [ ] Install Vercel CLI
2. [ ] Link to GitHub repo (optional but recommended)
3. [ ] Add environment variables in Vercel dashboard
4. [ ] Set up PostgreSQL database (Supabase recommended)
5. [ ] Deploy: `vercel --prod`

**Time Estimate:** 30-45 minutes

### Option B: Self-Hosted (AWS, DigitalOcean)
- [ ] Set up server or container
- [ ] Install Node.js and PostgreSQL
- [ ] Deploy Next.js with PM2 or Docker
- [ ] Configure domain and SSL

**Time Estimate:** 2-4 hours

### Option C: Docker Container
```bash
docker build -t aura-knot .
docker run -p 3000:3000 aura-knot
```

---

## Testing Checklist

### Authentication Flow
- [ ] OTP request works
- [ ] OTP verification succeeds with correct code
- [ ] OTP expires after 10 minutes
- [ ] Session persists after login
- [ ] Logout clears session

### Job Management
- [ ] Create job (all three categories)
- [ ] Display jobs in tracker pages
- [ ] Edit job details
- [ ] Delete job with confirmation
- [ ] Payment status updates reflect in dashboard

### Dashboard
- [ ] Total income calculates correctly
- [ ] Pending amount auto-updates
- [ ] Category breakdown is accurate
- [ ] Work status counts are correct
- [ ] Summary cards reflect changes in real-time

### Reports
- [ ] Monthly report generates correctly
- [ ] Yearly report shows data
- [ ] Custom date range works
- [ ] PDF export downloads without error
- [ ] Excel export has correct formatting

### Responsive Design
- [ ] Mobile (375px) – All pages functional
- [ ] Tablet (768px) – Layout adapts properly
- [ ] Desktop (1024px+) – Optimal experience

---

## File Locations Reference

| Feature | Files |
|---------|-------|
| Authentication | `src/lib/auth-*.ts`, `src/app/auth/login/` |
| Job APIs | `src/app/api/jobs/*` |
| Dashboard | `src/app/dashboard/`, `src/app/api/dashboard/` |
| Job Trackers | `src/app/jobs/{editing,exposing,other}/` |
| Reports | `src/app/reports/` |
| Database | `prisma/schema.prisma` |
| Config | `.env.local`, `tsconfig.json`, `next.config.js` |

---

## Quick Debugging Tips

### Build Issues
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Database Connection
```bash
# Check if Prisma can connect
npx prisma db execute --stdin < query.sql

# Open database GUI
npx prisma studio
```

### Check Logs
- NextAuth logs: Check browser console and terminal
- API errors: Check browser Network tab
- Database errors: Check Prisma client logs

### Reset Everything
```bash
# Drop all data and recreate schema
npx prisma migrate reset
```

---

## Success Criteria – MVP Complete When:

✅ **User can:**
1. Login with mobile OTP (real SMS or test via console)
2. View dashboard with income summary
3. Create jobs in all three categories (Editing, Exposing, Other)
4. Update payment status and see balance change
5. View all jobs in category-specific trackers
6. Generate and export reports as PDF/Excel
7. Access app on mobile and desktop with responsive design

✅ **System must:**
1. Persist all data in PostgreSQL
2. Calculate cumulative income correctly
3. Maintain secure user sessions
4. Handle errors gracefully
5. Work without manual database intervention

---

## Estimated Total Time to MVP

| Phase | Time |
|-------|------|
| Phase 2 (Database) | 1-2 hours |
| Phase 3 (OTP/SMS) | 1-2 hours |
| Phase 4 (Advanced) | 3-6 hours (optional) |
| Phase 5 (Deploy) | 1-2 hours |
| **Total** | **6-12 hours** |

**Current Status:** Phase 1 complete. Ready to start Phase 2.

---

Start with **Phase 2** when ready. Let me know if you need help with any step! 🚀
