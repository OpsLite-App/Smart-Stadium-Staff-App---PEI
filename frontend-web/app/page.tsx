// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona imediatamente para o login
    router.replace('/auth-routes/login');
  }, [router]);

  // Loading simples enquanto redireciona
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5]"></div>
    </div>
  );
}