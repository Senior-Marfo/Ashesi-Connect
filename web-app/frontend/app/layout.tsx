import type { ReactNode } from 'react';
import { SessionProvider } from '../lib/session';
import './globals.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Ashesi Graduation Tracker',
  description: 'Academic progress and graduation eligibility'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
