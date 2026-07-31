import { useCallback, useMemo, useState } from 'react'

export function useAdminSelection<T extends string | number>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(() => new Set())
  const selected = useMemo(() => Array.from(selectedIds), [selectedIds])
  const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds])
  const toggle = useCallback((id: T) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }), [])
  const selectPage = useCallback((ids: T[]) => setSelectedIds(new Set(ids)), [])
  const clear = useCallback(() => setSelectedIds(new Set()), [])
  return { selectedIds, selected, count: selectedIds.size, isSelected, toggle, selectPage, clear }
}
