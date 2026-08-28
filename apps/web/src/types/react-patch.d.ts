// Patch ReactPortal.children to be optional.
// This resolves a pnpm dual-module-instance conflict between @types/react@19.x
// and @types/react@18.x (brought in by NextUI) where ReactNode assignability
// breaks because the two ReactPortal definitions differ structurally.
import type { ReactNode } from 'react'

declare module 'react' {
  interface ReactPortal {
    children?: ReactNode
  }
}
