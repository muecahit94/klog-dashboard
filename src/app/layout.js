export const metadata = {
    title: 'klog Dashboard – Visual Time Tracking Analytics',
    description: 'A beautiful visual dashboard for klog time tracking files. Import, filter, and analyze your time bookings with interactive charts.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
            </head>
            <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
