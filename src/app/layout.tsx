import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Import Inter
// Removed GeistSans import as we are switching to Inter
import './globals.css';
import { Toaster } from "@/components/ui/toaster" // Import Toaster

// Configure Inter font
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'AI MoodLens', // Changed application name
  description: 'Let AI tune your photos based on your described mood and optional base styles.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Added suppressHydrationWarning to html tag
    <html lang="en" suppressHydrationWarning={true}>
      {/* Apply Inter font variable and antialiased class */}
      {/* Added suppressHydrationWarning to body tag to address potential extension interference */}
      {/* Added overflow-hidden to prevent scrolling */}
      <body className={`${inter.variable} font-sans antialiased overflow-hidden`} suppressHydrationWarning={true}>
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}

