import '../globals.css';
import { Suspense } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminSiteProvider } from '@/components/admin/AdminSiteContext';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata = {
  title: 'Admin · Baam',
  description: 'Baam Admin Panel',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth gate: only admin users can access /admin/*
  await requireAdmin();

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AdminSiteProvider>
          <Suspense>
            <AdminSidebar />
          </Suspense>
          <main className="lg:ml-60 min-h-screen">
            <Suspense>
              <AdminHeader />
            </Suspense>
            {children}
          </main>
        </AdminSiteProvider>
      </body>
    </html>
  );
}
