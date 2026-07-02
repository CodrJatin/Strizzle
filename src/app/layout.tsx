import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "strizzle",
  description: "strizzle — personal study platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("strizzle-theme")?.value || "default";

  // Determine server-rendered classes
  const isDarkServer = themeCookie === "dark" || themeCookie === "high-contrast";

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased ${isDarkServer ? "dark" : ""}`}
      data-theme={themeCookie}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = document.cookie.match(/(^|;)\\s*strizzle-theme\\s*=\\s*([^;]+)/);
                var currentTheme = theme ? theme[2] : 'default';
                if (currentTheme === 'system') {
                  var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  currentTheme = isDark ? 'dark' : 'default';
                }
                document.documentElement.setAttribute('data-theme', currentTheme);
                if (currentTheme === 'dark' || currentTheme === 'high-contrast') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            })()`
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <TRPCProvider>
          <ThemeProvider initialTheme={themeCookie}>
            {children}
          </ThemeProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
