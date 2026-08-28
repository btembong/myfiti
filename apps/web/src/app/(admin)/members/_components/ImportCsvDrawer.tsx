'use client'

import { useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import {
  Drawer, Button, Stack, Group, Text, ThemeIcon, Alert,
  Box, Table, Badge, ScrollArea, Divider, Progress,
} from '@mantine/core'
import {
  Upload04Icon, CheckmarkCircle01Icon, Alert01Icon,
  FileDownloadIcon, ArrowLeft01Icon, UserAdd01Icon,
  InformationCircleIcon,
} from 'hugeicons-react'

interface CsvRow {
  name: string
  email: string
  phone: string
  plan_name: string
  started_at: string
  expires_at: string
  notes: string
}

interface ImportResult {
  imported: number
  skipped: number
  skippedEmails: string[]
  subscriptionsCreated: number
}

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
// Handles quoted fields with commas inside them.

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [] }

  function splitLine(line: string): string[] {
    const fields: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  }).filter(r => Object.values(r).some(v => v.trim()))

  return { headers, rows }
}

// ─── Column name aliases ──────────────────────────────────────────────────────
const ALIASES: Record<keyof CsvRow, string[]> = {
  name:       ['name', 'full_name', 'fullname', 'member_name', 'member'],
  email:      ['email', 'email_address', 'e-mail'],
  phone:      ['phone', 'phone_number', 'mobile', 'contact', 'tel'],
  plan_name:  ['plan', 'plan_name', 'membership', 'membership_plan', 'package'],
  started_at: ['started_at', 'start_date', 'start', 'joined', 'join_date', 'date_joined'],
  expires_at: ['expires_at', 'expiry', 'expiry_date', 'end_date', 'expires', 'valid_until'],
  notes:      ['notes', 'note', 'comments', 'comment', 'remarks'],
}

function mapHeaders(headers: string[]): Partial<Record<keyof CsvRow, string>> {
  const mapping: Partial<Record<keyof CsvRow, string>> = {}
  for (const [field, aliases] of Object.entries(ALIASES) as [keyof CsvRow, string[]][]) {
    const match = headers.find(h => aliases.includes(h))
    if (match) mapping[field] = match
  }
  return mapping
}

function rowToCsvRow(raw: Record<string, string>, mapping: Partial<Record<keyof CsvRow, string>>): CsvRow {
  return {
    name:       raw[mapping.name ?? '']?.trim() ?? '',
    email:      raw[mapping.email ?? '']?.trim() ?? '',
    phone:      raw[mapping.phone ?? '']?.trim() ?? '',
    plan_name:  raw[mapping.plan_name ?? '']?.trim() ?? '',
    started_at: raw[mapping.started_at ?? '']?.trim() ?? '',
    expires_at: raw[mapping.expires_at ?? '']?.trim() ?? '',
    notes:      raw[mapping.notes ?? '']?.trim() ?? '',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportCsvDrawer({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Partial<Record<keyof CsvRow, string>>>({})
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function reset() {
    setRows([]); setMapping({}); setParseError('')
    setImporting(false); setResult(null)
  }

  function close() { reset(); onClose() }

  function processFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a .csv file.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      try {
        const { headers, rows: rawRows } = parseCsv(text)
        if (!headers.length) { setParseError('Empty or invalid CSV file.'); return }
        const m = mapHeaders(headers)
        if (!m.name && !m.email) {
          setParseError('Could not detect Name or Email columns. Make sure your CSV has "Name" and "Email" headers.')
          return
        }
        const parsed = rawRows.map(r => rowToCsvRow(r, m))
        setMapping(m)
        setRows(parsed)
        setParseError('')
      } catch {
        setParseError('Failed to parse CSV. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  async function handleImport() {
    const valid = rows.filter(r => r.name && r.email && r.email.includes('@'))
    if (!valid.length) { setParseError('No valid rows found (name + email required).'); return }

    setImporting(true)
    try {
      const res = await api.post<ImportResult>('/api/members/import', {
        members: valid.map(r => ({
          name:       r.name,
          email:      r.email,
          phone:      r.phone || undefined,
          notes:      r.notes || undefined,
          plan_name:  r.plan_name || undefined,
          started_at: r.started_at || undefined,
          expires_at: r.expires_at || undefined,
        })),
      })
      setResult(res)
      onImported()
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const validRows  = rows.filter(r => r.name && r.email && r.email.includes('@'))
  const invalidRows = rows.filter(r => !r.name || !r.email || !r.email.includes('@'))
  const withPlan   = validRows.filter(r => r.plan_name)

  return (
    <Drawer
      opened={open}
      onClose={close}
      position="right"
      size="xl"
      padding={0}
      withCloseButton={false}
      styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box px="xl" py="lg" style={{ borderBottom: '1px solid #f0f1f5', flexShrink: 0 }}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size={36} radius="xl" color="violet" variant="light">
              <Upload04Icon size={17} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="sm" fw={700} style={{ color: '#111827' }}>Import members from CSV</Text>
              <Text size="xs" c="dimmed">Upload a spreadsheet exported from Excel, Google Sheets, or your old system</Text>
            </Stack>
          </Group>
          <Button variant="subtle" color="gray" size="xs" onClick={close} px="xs">✕</Button>
        </Group>
      </Box>

      <Box px="xl" py="lg" style={{ flex: 1, overflowY: 'auto' }}>
        <Stack gap="lg">

          {/* Result state */}
          {result ? (
            <Stack gap="md">
              <Box p="xl" style={{ background: '#ecfdf5', borderRadius: 14, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <CheckmarkCircle01Icon size={32} style={{ color: '#059669', margin: '0 auto 12px' }} />
                <Text fw={700} size="lg" style={{ color: '#065f46' }}>Import complete</Text>
              </Box>
              <Table withTableBorder withRowBorders={false} highlightOnHover>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td><Text size="sm" c="dimmed">Members imported</Text></Table.Td>
                    <Table.Td><Badge color="teal" variant="light">{result.imported}</Badge></Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td><Text size="sm" c="dimmed">Subscriptions created</Text></Table.Td>
                    <Table.Td><Badge color="indigo" variant="light">{result.subscriptionsCreated}</Badge></Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td><Text size="sm" c="dimmed">Skipped (already exist)</Text></Table.Td>
                    <Table.Td><Badge color="gray" variant="light">{result.skipped}</Badge></Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              {result.skippedEmails.length > 0 && (
                <Alert icon={<InformationCircleIcon size={14} />} color="gray" variant="light" radius="md">
                  <Text size="xs" fw={600} mb={4}>Skipped emails (already registered):</Text>
                  <Text size="xs" c="dimmed">{result.skippedEmails.join(', ')}</Text>
                </Alert>
              )}
              <Text size="xs" c="dimmed" ta="center">Welcome emails with QR codes sent to all imported members.</Text>
            </Stack>
          ) : rows.length === 0 ? (
            /* ── File drop zone ── */
            <Stack gap="md">
              <Box
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#6366f1' : '#e5e7eb'}`,
                  borderRadius: 14,
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? '#eef2ff' : '#fafafa',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
                />
                <ThemeIcon size={48} radius="xl" color="violet" variant="light" style={{ margin: '0 auto 12px' }}>
                  <Upload04Icon size={22} />
                </ThemeIcon>
                <Text fw={600} size="sm" style={{ color: '#374151' }}>Drop your CSV file here, or click to browse</Text>
                <Text size="xs" c="dimmed" mt={4}>.csv files only · max 500 rows</Text>
              </Box>

              {parseError && (
                <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">{parseError}</Alert>
              )}

              {/* Format guide */}
              <Box p="md" style={{ background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <Text size="xs" fw={700} mb={8} style={{ color: '#374151' }}>Expected CSV format</Text>
                <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', lineHeight: 1.8 }}>
                  Name, Email, Phone, Plan, Start Date, Expires At, Notes
                </Text>
                <Divider my="xs" />
                <Stack gap={4}>
                  {[
                    ['Name, Email', 'Required'],
                    ['Phone, Notes', 'Optional'],
                    ['Plan', 'Matched to your existing plans by name'],
                    ['Start Date / Expires At', 'ISO date or DD/MM/YYYY'],
                  ].map(([field, desc]) => (
                    <Group key={field} gap="xs">
                      <Text size="xs" fw={600} style={{ color: '#6366f1', minWidth: 160 }}>{field}</Text>
                      <Text size="xs" c="dimmed">{desc}</Text>
                    </Group>
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : (
            /* ── Preview state ── */
            <Stack gap="md">
              {/* Stats */}
              <Group gap="sm">
                <Badge color="teal" variant="light" size="md">{validRows.length} valid</Badge>
                {invalidRows.length > 0 && <Badge color="red" variant="light" size="md">{invalidRows.length} invalid (no name/email)</Badge>}
                {withPlan.length > 0 && <Badge color="indigo" variant="light" size="md">{withPlan.length} with plan</Badge>}
              </Group>

              {/* Mapped columns */}
              <Alert icon={<InformationCircleIcon size={14} />} color="blue" variant="light" radius="md">
                <Text size="xs" fw={600} mb={4}>Detected columns:</Text>
                <Text size="xs" c="dimmed">
                  {Object.entries(mapping).map(([k, v]) => `${k} → "${v}"`).join(' · ')}
                </Text>
              </Alert>

              {parseError && (
                <Alert icon={<Alert01Icon size={14} />} color="red" variant="light" radius="md">{parseError}</Alert>
              )}

              {/* Preview table */}
              <Text size="xs" fw={700} c="dimmed">Preview (first 10 rows)</Text>
              <ScrollArea>
                <Table withTableBorder withRowBorders highlightOnHover style={{ fontSize: 12 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Phone</Table.Th>
                      <Table.Th>Plan</Table.Th>
                      <Table.Th>Expires</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.slice(0, 10).map((r, i) => {
                      const valid = r.name && r.email && r.email.includes('@')
                      return (
                        <Table.Tr key={i} style={{ opacity: valid ? 1 : 0.4 }}>
                          <Table.Td>{r.name || <Text size="xs" c="red">missing</Text>}</Table.Td>
                          <Table.Td>{r.email || <Text size="xs" c="red">missing</Text>}</Table.Td>
                          <Table.Td>{r.phone || '—'}</Table.Td>
                          <Table.Td>{r.plan_name || '—'}</Table.Td>
                          <Table.Td>{r.expires_at || '—'}</Table.Td>
                          <Table.Td>
                            {valid
                              ? <Badge size="xs" color="teal" variant="dot">ok</Badge>
                              : <Badge size="xs" color="red" variant="dot">skip</Badge>}
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {rows.length > 10 && (
                <Text size="xs" c="dimmed" ta="center">… and {rows.length - 10} more rows</Text>
              )}

              {importing && (
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">Importing {validRows.length} members…</Text>
                  <Progress value={100} animated color="indigo" radius="xl" size="sm" />
                </Stack>
              )}

              <Button
                variant="subtle" color="gray" size="xs"
                leftSection={<ArrowLeft01Icon size={12} />}
                onClick={reset}
              >
                Upload a different file
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Footer */}
      {!result && (
        <Box px="xl" py="lg" style={{ borderTop: '1px solid #f0f1f5', flexShrink: 0 }}>
          <Group gap="sm">
            <Button flex={1} variant="default" onClick={close}>Cancel</Button>
            {rows.length > 0 && (
              <Button
                flex={1} color="violet" loading={importing}
                disabled={validRows.length === 0}
                leftSection={importing ? undefined : <UserAdd01Icon size={14} />}
                onClick={handleImport}
              >
                {importing ? 'Importing…' : `Import ${validRows.length} member${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </Group>
        </Box>
      )}
    </Drawer>
  )
}
