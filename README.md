# Aura Knot Photography – Income Tracking & Job Management System

A modern, mobile-first web application for photographers to manage their income across multiple revenue streams (Editing, Exposing, and Other Income), track payments, and generate detailed financial reports.

## Features

✅ **Mobile OTP Authentication** – Secure login with 10-digit mobile number verification
✅ **Dashboard Overview** – Real-time income summaries and work status tracking
✅ **Three Income Trackers** – Dedicated modules for Editing, Exposing, and Other income
✅ **Job Management** – Create, edit, and track photography jobs with payment status
✅ **Cumulative Income Logic** – Automatic totals across all categories
✅ **Payment Tracking** – Monitor pending, partial, and completed payments
✅ **Reports & Export** – Generate monthly/yearly reports with PDF and Excel export
✅ **Responsive Design** – Fully optimized for mobile and desktop

## Tech Stack

- **Frontend:** Next.js 14 (React 19) + TypeScript
- **Styling:** Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** NextAuth.js v4
- **Export:** jsPDF, xlsx
- **UI Components:** Lucide React Icons
- **State Management:** Zustand

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   └── login/               # OTP login page
│   ├── api/
│   │   ├── auth/               # NextAuth routes + OTP endpoint
│   │   ├── jobs/               # Job CRUD API routes
│   │   └── dashboard/          # Dashboard summary API
│   ├── jobs/
│   │   ├── editing/            # Editing income tracker
│   │   ├── exposing/           # Exposing income tracker
│   │   └── other/              # Other income tracker
│   ├── dashboard/              # Main dashboard
│   ├── reports/                # Reports & export module
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   └── globals.css             # Global styles
├── lib/
│   ├── prisma.ts               # Prisma client setup
│   ├── auth-service.ts         # OTP logic
│   └── auth-config.ts          # NextAuth configuration
└── types/
    └── next-auth.d.ts          # TypeScript declarations

prisma/
└── schema.prisma               # Database schema
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or cloud)

### Installation

1. **Install Dependencies**
```bash
npm install
```

2. **Set up Environment Variables**
```bash
cp .env.example .env.local
```

Update `.env.local` with your database URL and NextAuth secret:
```bash
# Generate a secure NEXTAUTH_SECRET
openssl rand -base64 32
```

3. **Set up Database**
```bash
npx prisma migrate dev --name init
```

4. **Run Development Server**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Endpoints

### Authentication
- `POST /api/auth/send-otp` – Send OTP to mobile number
- `POST /api/auth/[...nextauth]` – NextAuth routes

### Jobs
- `GET /api/jobs` – Fetch all jobs for user
- `POST /api/jobs` – Create new job
- `GET /api/jobs/[id]` – Get specific job
- `PUT /api/jobs/[id]` – Update job
- `DELETE /api/jobs/[id]` – Delete job

### Dashboard
- `GET /api/dashboard/summary` – Get cumulative income & summary

## User Flow

1. **Login** → Enter mobile number → Verify OTP → Access dashboard
2. **Dashboard** → View total income, pending amount, work status
3. **Add Job** → Select category → Fill job details
4. **Update Payment** → Change status → Auto-update balance
5. **View Reports** → Select date range → Export PDF/Excel

## Key Components

### Dashboard (`/dashboard`)
- Total income (all categories combined)
- Total paid & pending amounts
- Work status counts (Pending, In Progress, Completed)
- Category-wise breakdown (Editing, Exposing, Other)
- Quick action buttons

### Job Trackers
- **Editing** (`/jobs/editing`) – Camera count, duration, event type
- **Exposing** (`/jobs/exposing`) – Studio, session type, exposure type
- **Other** (`/jobs/other`) – Custom work type, notes, customer details

### Reports (`/reports`)
- Monthly, yearly, and custom date range reports
- Category-wise income breakdown
- PDF and Excel export
- Payment status summary

## Database Schema

### User Table
- `id` – Unique identifier
- `phone` – Mobile number (unique)
- `otp` – OTP for verification
- `otpExpiry` – OTP expiration
- `verified` – Verification status

### Job Table
- `category` – EDITING | EXPOSING | OTHER
- `status` – PENDING | IN_PROGRESS | COMPLETED
- `totalPrice` – Total job amount
- `amountPaid` – Payment received
- `balanceAmount` – Auto-calculated pending
- `paymentStatus` – PENDING | PARTIAL | COMPLETED
- Category-specific fields

### Report Table
- `reportType` – MONTHLY | YEARLY | CUSTOM
- `startDate` / `endDate` – Period
- `totalIncome` – Sum of jobs
- `data` – JSON breakdown

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Environment Setup
- Set up PostgreSQL on Supabase or AWS RDS
- Add environment variables in Vercel dashboard
- Run `npx prisma migrate deploy`

## Troubleshooting

**Database Connection Error**
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env.local`

**Build Issues**
- Clear `.next`: `rm -rf .next`
- Reinstall: `npm install`
- Rebuild: `npm run build`

## Future Enhancements

- SMS OTP integration (Twilio/Firebase)
- Auth middleware for protected routes
- Advanced filtering & search
- Job edit/delete UI
- Payment reminders
- Cloud database deployment
- Mobile app (React Native)
- Analytics charts
- Invoice generation

## License

MIT License

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
