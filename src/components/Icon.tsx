import type { ReactNode } from 'react'

// Inline SVG only: no icon font, no remote images.
const PATHS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5V14h4v5.5h4.5V10" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.5" />
    </>
  ),
  map: <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  chat: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-7l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5Zm3.5 5h7m-7 3h4" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  back: <path d="m14 5-7 7 7 7" />,
  'wifi-off': (
    <>
      <path d="M4 4l16 16M8.5 15.5a5 5 0 0 1 5.6-.9M5.5 12.2a9 9 0 0 1 4-2.3m4.2-.3a9 9 0 0 1 4.8 2.6M2.5 9a13.5 13.5 0 0 1 4.2-2.9m4-.9A13.5 13.5 0 0 1 21.5 9" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  dash: <path d="M7 12h10" />,
  sliders: <path d="M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17m0-17c-2.5 2.6-2.5 14.4 0 17" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6v.4" />
    </>
  ),
  send: <path d="M4 12 20 4l-5 16-3-6.5L4 12Z" />,
  tools: <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.500-5.500a4 4 0 0 0 5-5L15 12l-3-3 2.500-2.500Z" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

interface IconProps {
  name: IconName
  className?: string
}

/** Decorative by default. Give the parent control its own accessible name. */
export function Icon({ name, className = 'size-6' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
