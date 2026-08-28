'use client'

import { useState, useMemo } from 'react'
import { Group, Text, ActionIcon, Select } from '@mantine/core'
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from 'hugeicons-react'

// ─── Sorting hook ────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc'

export function useSort<T>(data: T[], defaultKey?: keyof T, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function toggleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const sa = String(av).toLowerCase()
      const sb = String(bv).toLowerCase()
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggleSort }
}

// ─── Pagination hook ─────────────────────────────────────────────────────────

export function usePagination<T>(data: T[], defaultPerPage = 20) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(defaultPerPage)

  const totalPages = Math.max(1, Math.ceil(data.length / perPage))
  const safePage = Math.min(page, totalPages)

  const paged = useMemo(() => {
    const start = (safePage - 1) * perPage
    return data.slice(start, start + perPage)
  }, [data, safePage, perPage])

  function goTo(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)))
  }

  function changePerPage(pp: number) {
    setPerPage(pp)
    setPage(1)
  }

  return { paged, page: safePage, perPage, totalPages, total: data.length, goTo, changePerPage }
}

// ─── Sort header component ──────────────────────────────────────────────────

export function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string
  sortKey: string
  currentKey: string | null
  currentDir: SortDir
  onSort: (key: string) => void
}) {
  const active = currentKey === sortKey
  return (
    <Group
      gap={4}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(sortKey)}
    >
      <Text size="xs" fw={600} c={active ? 'indigo' : 'dimmed'}>
        {label}
      </Text>
      {active && (
        currentDir === 'asc'
          ? <ArrowUp01Icon size={10} style={{ color: '#6366f1' }} />
          : <ArrowDown01Icon size={10} style={{ color: '#6366f1' }} />
      )}
    </Group>
  )
}

// ─── Pagination controls component ──────────────────────────────────────────

export function PaginationBar({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
}: {
  page: number
  totalPages: number
  total: number
  perPage: number
  onPageChange: (p: number) => void
  onPerPageChange: (pp: number) => void
}) {
  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  return (
    <Group justify="space-between" px="lg" py="sm" style={{ borderTop: '1px solid #f4f5f9' }}>
      <Group gap="sm">
        <Text size="xs" c="dimmed">
          {total > 0 ? `${start}–${end} of ${total}` : 'No results'}
        </Text>
        <Select
          size="xs"
          radius="md"
          value={String(perPage)}
          onChange={v => onPerPageChange(Number(v))}
          data={['10', '20', '50', '100']}
          style={{ width: 72 }}
          comboboxProps={{ withinPortal: true }}
        />
        <Text size="xs" c="dimmed">per page</Text>
      </Group>
      <Group gap={4}>
        <ActionIcon
          size="sm" variant="subtle" color="gray"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ArrowLeft01Icon size={14} />
        </ActionIcon>
        <Text size="xs" fw={600} style={{ color: '#374151', minWidth: 60, textAlign: 'center' }}>
          {page} / {totalPages}
        </Text>
        <ActionIcon
          size="sm" variant="subtle" color="gray"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ArrowRight01Icon size={14} />
        </ActionIcon>
      </Group>
    </Group>
  )
}
