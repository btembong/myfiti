import { type ReactNode } from 'react'

export const metadata = {
  title: 'Gymflow Kiosk',
  description: 'Member check-in kiosk',
}

export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#020817',
      overflow: 'hidden',
      fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif",
      WebkitUserSelect: 'none',
      userSelect: 'none',
    }}>
      {children}
    </div>
  )
}
