import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
)
export const IconScale = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M12 3v18M7 21h10M4 7h16M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z" /></svg>
)
export const IconBook = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>
)
export const IconUser = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconNext = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M9 5l7 7-7 7" /></svg>
)
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.4} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.6} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconMinus = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.6} {...p}><path d="M5 12h14" /></svg>
)
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.6} {...p}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
)
export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size ?? 12)} strokeWidth={2.4} {...p}><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>
)
export const IconCamera = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
)
export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
)
export const IconLogout = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></svg>
)
export const IconBookmark = ({ size, filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size)} strokeWidth={2} fill={filled ? 'currentColor' : 'none'} {...p}><path d="M6 4h12v17l-6-4-6 4z" /></svg>
)
/** Zielscheibe: steht für „Mein Geschmack" */
export const IconSpark = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
)
export const IconGlass =({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={1.8} {...p}><path d="M7 3h10c0 0 1 5-.5 8a4.5 4.5 0 0 1-9 0C6 8 7 3 7 3z" /><path d="M12 15.5V20M8.5 21h7" /></svg>
)
export const IconUsers = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.8" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M15 14.5a5 5 0 0 1 6.5 5.5" /></svg>
)
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} strokeWidth={2.2} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
)
export const IconSend = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg>
)
export const IconMedal = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><circle cx="12" cy="9" r="6" /><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7" /></svg>
)
export const IconTrash =({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
