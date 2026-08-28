'use client'

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface SidebarCtx {
  collapsed: boolean
  toggle: () => void
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} })

export const useSidebar = () => useContext(Ctx)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
    } catch {}
  }, [])

  function toggle() {
    setCollapsed(v => {
      try { localStorage.setItem('sidebar-collapsed', String(!v)) } catch {}
      return !v
    })
  }

  return React.createElement(Ctx.Provider, { value: { collapsed, toggle } }, children)
}
