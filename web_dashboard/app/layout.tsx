import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM Analytics Dashboard',
  description: 'Trực quan hóa dữ liệu hành vi xem nội dung và tìm kiếm của khách hàng',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
