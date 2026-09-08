import type React from 'react';

export function YoutubeIcon({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      {...props}
    >
      <path d="M2.5 8.5c0-2.2 1.8-4 4-4h11c2.2 0 4 1.8 4 4v7c0 2.2-1.8 4-4 4h-11c-2.2 0-4-1.8-4-4z" />
      <path d="m10 8.5 6 3.5-6 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
