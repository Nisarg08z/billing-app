# Bapa Sitaram Billing

Restaurant billing website: tables, orders, bills, daily sales. Built with **Next.js**, data stored in **MongoDB**.
Every phone that signs in sees the same tables, running orders and bills. Changes appear on the other phones in under a second
(live updates via Server-Sent Events and MongoDB change streams, `app/api/live`; an 8-second check is the fallback).

```
app/                 pages (/, /login) and API routes (app/api/*)
components/          BillingApp.jsx: the screens' markup
lib/client/app.js    everything the screens do: orders, bills, gestures, printing, sync with the server
lib/data.js          MongoDB reads and writes
lib/auth.js          password sign-in (cookie)
public/              fonts, icons, web app manifest
```

## Features

- Tables with Free / Running status, time open, and filters; long-press a table to open,
  move the order to another table, or clear it
- Menu with categories and search; tap a dish to add, − / + on the card and in the bill
- Discount %, GST % (printed as CGST + SGST), payment Cash / UPI
- Bill receipt on screen, with the UPI QR for UPI payments
- Bills: any date, sales by payment mode, top dishes, cancel a bill, export CSV
- Settings: light / dark / system theme (per phone), menu, categories, tables, sign-in password
- Phone gestures: swipe between tabs, swipe from the left edge to go back, drag sheets down to close

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `MONGODB_URI`: your MongoDB Atlas connection string
   - `MONGODB_DB`: database name (default `bapa_sitaram`)
   - `APP_PASSWORD`: the password staff type to sign in
   - `AUTH_SECRET`: a long random string
2. In MongoDB Atlas → **Network Access**, allow the IP address of the computer or server running the site
   (for Vercel, allow `0.0.0.0/0`, since Vercel has no fixed IP).

```bash
npm install
npm run dev
```

Open http://localhost:3000. To try it on your phone on the same Wi-Fi, open `http://<this computer's IP>:3000`.

## Put it online (Vercel, free)

1. Push this folder to GitHub (`.env.local` is not uploaded; it is in `.gitignore`).
2. On vercel.com → **Add New Project** → pick the repository.
3. Under **Environment Variables**, add the four values from `.env.local`.
4. Deploy. Open the URL on each phone and sign in. To put it on the home screen, use the browser menu → Add to Home Screen.

