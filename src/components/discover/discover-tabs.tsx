'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { usePathname } from '@/lib/i18n/routing';

const tabs = [
  { key: 'recommend', label: 'Recommended' },
  { key: 'following', label: 'Following' },
  { key: 'notes', label: 'Posts' },
  { key: 'videos', label: 'Videos' },
  { key: 'topics', label: 'Topics' },
] as const;

export function DiscoverTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'recommend';

  const handleTabClick = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'recommend') {
      params.delete('tab');
    } else {
      params.set('tab', key);
    }
    params.delete('page');
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabClick(tab.key)}
          className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
