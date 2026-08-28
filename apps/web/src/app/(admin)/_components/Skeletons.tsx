'use client'

import { Skeleton, Stack, Group, Paper, Box, SimpleGrid } from '@mantine/core'

/** Skeleton for a row of stat/KPI cards */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: count }} spacing="md">
      {Array.from({ length: count }, (_, i) => (
        <Paper key={i} radius="xl" p="lg" withBorder style={{ borderColor: '#edeef4' }}>
          <Skeleton height={17} width={17} radius="xl" mb="md" />
          <Skeleton height={32} width="60%" radius="sm" mb={6} />
          <Skeleton height={14} width="80%" radius="sm" />
        </Paper>
      ))}
    </SimpleGrid>
  )
}

/** Skeleton for a data table (header + rows) */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Paper radius="xl" withBorder style={{ borderColor: '#edeef4', overflow: 'hidden' }}>
      {/* Table header */}
      <Group px="lg" py="md" style={{ borderBottom: '1px solid #f4f5f9' }}>
        <Skeleton height={14} width={120} radius="sm" />
        <Box style={{ flex: 1 }} />
        <Skeleton height={28} width={180} radius="md" />
        <Skeleton height={28} width={200} radius="xl" />
      </Group>

      {/* Column headers */}
      <Group px="lg" py={8} style={{ borderBottom: '1px solid #f9fafb' }}>
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} height={12} width={i === 0 ? '25%' : 80} radius="sm" style={{ flex: i === 0 ? 1 : undefined }} />
        ))}
      </Group>

      {/* Rows */}
      <Stack gap={0}>
        {Array.from({ length: rows }, (_, i) => (
          <Group key={i} px="lg" py="sm" style={{ borderBottom: '1px solid #f9fafb' }}>
            <Group gap="sm" style={{ flex: 1 }}>
              <Skeleton height={28} width={28} circle />
              <Skeleton height={14} width="40%" radius="sm" />
            </Group>
            {Array.from({ length: cols - 1 }, (_, j) => (
              <Skeleton key={j} height={12} width={j === cols - 2 ? 60 : 80} radius="sm" />
            ))}
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}

/** Skeleton for the page header */
export function PageHeaderSkeleton() {
  return (
    <Group justify="space-between" align="flex-end" pb="lg" style={{ borderBottom: '1px solid #edeef4' }}>
      <Stack gap={4}>
        <Skeleton height={12} width={100} radius="sm" />
        <Skeleton height={28} width={200} radius="sm" />
        <Skeleton height={14} width={280} radius="sm" />
      </Stack>
      <Group gap="sm">
        <Skeleton height={34} width={90} radius="md" />
        <Skeleton height={34} width={130} radius="md" />
      </Group>
    </Group>
  )
}

/** Full page skeleton combining header + stats + table */
export function PageSkeleton({ statCount = 4, tableRows = 6, tableCols = 5 }: {
  statCount?: number; tableRows?: number; tableCols?: number
}) {
  return (
    <Stack gap="lg" p="xl" maw={1400}>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={statCount} />
      <TableSkeleton rows={tableRows} cols={tableCols} />
    </Stack>
  )
}
