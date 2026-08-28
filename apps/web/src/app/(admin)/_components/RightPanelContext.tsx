'use client'

import React, { createContext, useContext, useState, type ReactNode } from 'react'

interface PanelCtx {
  content: ReactNode | null
  title: string
  isOpen: boolean
  open: (title: string, content: ReactNode) => void
  close: () => void
}

const Ctx = createContext<PanelCtx>({
  content: null, title: '', isOpen: false,
  open: () => {}, close: () => {},
})

export const useRightPanel = () => useContext(Ctx)

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ title: string; content: ReactNode | null }>({
    title: '', content: null,
  })

  return React.createElement(Ctx.Provider, {
    value: {
      content:  state.content,
      title:    state.title,
      isOpen:   state.content !== null,
      open:     (title: string, content: ReactNode) => setState({ title, content }),
      close:    () => setState({ title: '', content: null }),
    },
  }, children)
}
