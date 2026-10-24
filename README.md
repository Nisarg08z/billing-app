# Bapa Sitaram Billing

Restaurant billing app: tables, orders, bills, daily sales. Works offline; data stays on the device.
One codebase runs as a website, an installable web app, and a native iOS / Android app (Capacitor).

```
www/                  the app (index.html, manifest, service worker, icons)
assets/               app icon + launch screen sources for iOS / Android
scripts/make-icons.js regenerates icons and launch screens
scripts/get-fonts.js  downloads the fonts into www/fonts (they ship with the app, so it works offline)
capacitor.config.json native app settings
codemagic.yaml        cloud iOS build (no Mac needed)
```

## Features

- Opening animation with the Bapa Sitaram name (tap to skip)
- Tables with Free / Running status, time open, and filters; long-press a table to open, print KOT,
  move the order to another table, or clear it
- Menu with categories and search; tap a dish to add, − / + on the card and in the bill
- Discount %, GST % (printed as CGST + SGST), payment Cash / UPI / Card
- Print bill (80 mm thermal), print KOT, share bill on WhatsApp
- Bills: any date, sales by payment mode, top dishes, cancel a bill, export CSV
- Settings: restaurant details, light / dark / system theme, menu, categories, tables, backup and restore

### Phone gestures
- Swipe left / right to move between Tables, Bills and Settings
- Swipe from the left edge on an order to go back
- Drag the bill or receipt down to close it
- Long-press a table for quick actions

### In the native app only
- Haptic feedback (taps, saving a bill, warnings)
- Status bar colour follows the theme
- Backup and CSV export open the iOS share sheet (Save to Files, WhatsApp, Mail)
- Android back button closes sheets and goes back

## Run on this computer

```bash
npm run serve
```

Open http://localhost:8080.

## Build the iOS app

Apple only lets iOS apps be built on a Mac. You need an **Apple Developer account** ($99/year) either way.

### Without a Mac: Codemagic (cloud Mac)

1. Put this folder in a GitHub repository.
2. Sign in at codemagic.io with GitHub and add the repository.
3. Follow the three setup notes at the top of `codemagic.yaml` (App Store Connect API key, app record).
4. Start the **iOS → TestFlight** workflow. When it finishes, install the build on your iPhone
   from the **TestFlight** app.

### With a Mac

```bash
npm install
npm run ios:add
npm run ios:open
```

In Xcode: choose your team under *Signing & Capabilities*, then Product → Archive.

## Android APK (works on Windows)

Install Android Studio, then:

```bash
npm run android:add
npm run android:open
```

Build → Build App Bundle(s) / APK(s) → Build APK(s).

After any change in `www/`, run `npm run sync` before building again.
After changing the logo in `scripts/make-icons.js`, run `npm run icons` and `npm run assets`.

## Things to check on a real iPhone

- **Printing**: printing from inside an iOS app view has not been tested yet. If the Print button does
  nothing in the app, a print plugin needs to be added.
"# billing-app" 
