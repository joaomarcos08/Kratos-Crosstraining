import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Training Center Pro",
    description: "Gestão inteligente de mensalidades",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" className="dark">
            <body className={inter.className}>
                {children}
                <Toaster richColors position="bottom-right" closeButton />
            </body>
        </html>
    );
}
