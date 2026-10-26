import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import { SessionProvider } from '@/lib/session';
import { I18nProvider } from '@/lib/i18n';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-bricolage' });
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: { default: 'SHAPE Potential Africa', template: '%s | SHAPE Potential Africa' },
  description: 'SHAPE Potential Africa supports African youth, women and institutions through technology, education, leadership, young startups and agriculture.',
  icons: { icon: '/logo.png' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

// apply the saved theme before first paint (light by default)
const themeScript = `try{var t=localStorage.getItem('spa-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${bricolage.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider>
          <SessionProvider>{children}</SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
