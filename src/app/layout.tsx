import type { Metadata } from 'next';
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google';
import { ClerkProvider } from '@/lib/clerk';
import Header from '@/components/Header';
import AmbientCanvas from '@/components/AmbientCanvas';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'NeedBoard — Collective Problem Clustering',
  description: 'See the noise become a pattern. A platform where scattered frustrations cluster into visible collective signal.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500/30 selection:text-slate-100">
          {/* Custom Ambient Background & Interactive Cursor */}
          <AmbientCanvas />
          {/* CRT scanline overlay */}
          <div className="scanlines" aria-hidden="true" />
          {/* <CustomCursor /> */}
          
          <Header />
          <main className="flex-grow flex flex-col relative z-10">
            {children}
          </main>

          <footer className="relative z-10 border-t border-white/5 bg-slate-950/40 py-6 text-center font-mono text-[10px] tracking-widest text-slate-500 uppercase">
            © 2026 NeedBoard. ALL INDIVIDUAL VOICES RESONATE IN COLLECTIVE SIGNAL.
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
