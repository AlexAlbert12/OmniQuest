import React from 'react'
import { AdminListToolbar } from './AdminPrimitives'

export default function AdminSearchBar({
  search,
  onChangeSearch,
  placeholder,
  exporting = false,
  onExport,
  exportLabel,
}: {
  search: string
  onChangeSearch: (value: string) => void
  placeholder: string
  exporting?: boolean
  onExport?: () => void
  exportLabel?: string
}) {
  return (
    <AdminListToolbar
      search={search}
      onChangeSearch={onChangeSearch}
      placeholder={placeholder}
      exporting={exporting}
      onExport={onExport}
      exportLabel={exportLabel}
    />
  )
}
