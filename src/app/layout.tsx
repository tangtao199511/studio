import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed GeistMono import as it was causing module not found error
import './globals.css';
import { Toaster } from "@/components/ui/toaster" // Import Toaster

export const metadata: Metadata = {
  title: 'AnalogLens',
  description: 'Apply analog film styles to your photos with AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Added suppressHydrationWarning to html tag
    <html lang="en" suppressHydrationWarning={true}>
      {/* Removed GeistMono variable as it's not imported */}
      {/* Added suppressHydrationWarning to body tag to address potential extension interference */}
      <body className={`${GeistSans.variable} antialiased`} suppressHydrationWarning={true}>
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
