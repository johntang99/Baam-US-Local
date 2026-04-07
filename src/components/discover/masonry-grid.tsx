'use client';

import { ReactNode, Children } from 'react';

interface MasonryGridProps {
  children: ReactNode;
  columns?: number;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  const items = Children.toArray(children);

  // 2 columns on mobile, 3 on sm+
  const cols2: ReactNode[][] = [[], []];
  const cols3: ReactNode[][] = [[], [], []];

  items.forEach((child, i) => {
    cols2[i % 2].push(child);
    cols3[i % 3].push(child);
  });

  return (
    <>
      {/* Mobile: 2 columns */}
      <div className="flex gap-3 sm:hidden">
        {cols2.map((colItems, colIndex) => (
          <div key={colIndex} className="flex-1 min-w-0 space-y-3">
            {colItems}
          </div>
        ))}
      </div>
      {/* Desktop: 3 columns */}
      <div className="hidden sm:flex gap-4">
        {cols3.map((colItems, colIndex) => (
          <div key={colIndex} className="flex-1 min-w-0 space-y-4">
            {colItems}
          </div>
        ))}
      </div>
    </>
  );
}
