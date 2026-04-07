'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function LayoutToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isClassic = searchParams.get('layout') === 'classic';

  const toggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isClassic) {
      params.delete('layout');
    } else {
      params.set('layout', 'classic');
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full px-3 py-2">
      <span className={`text-xs font-medium ${!isClassic ? 'text-primary' : 'text-gray-400'}`}>New</span>
      <button
        onClick={toggle}
        className={`relative w-10 h-5 rounded-full transition-colors ${isClassic ? 'bg-gray-300' : 'bg-primary'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isClassic ? 'left-0.5' : 'left-[22px]'}`} />
      </button>
      <span className={`text-xs font-medium ${isClassic ? 'text-primary' : 'text-gray-400'}`}>Classic</span>
    </div>
  );
}
