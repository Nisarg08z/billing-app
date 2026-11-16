import './globals.css';

export const metadata = {
  title: 'Bapa Sitaram Billing',
  description: 'Table orders, bills and daily sales for Bapa Sitaram Restaurant.',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }], apple: '/icons/icon-180.png' },
  appleWebApp: { capable: true, title: 'Bapa Sitaram', statusBarStyle: 'default' },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android: the keyboard shrinks the page (like iOS) instead of covering the bill's inputs
  interactiveWidget: 'resizes-content',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0e0d' },
  ],
};

// Apply the saved theme before the page paints, so there is no white/black flash
const themeScript = `try{var t=localStorage.getItem('bapa_theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preload" href="/fonts/Figtree-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/BodoniModa-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
