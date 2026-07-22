import React from 'react'
import { AdminListToolbar } from './AdminPortalCore'

export default function AdminSearchBar({
  search,
  onChangeSearch,
  placeholder,
  exporting = false,
  onExport,
}: {
  search: string
  onChangeSearch: (value: string) => void
  placeholder: string
  exporting?: boolean
  onExport?: () => void
}) {
  return (
    <AdminListToolbar
      search={search}
      onChangeSearch={onChangeSearch}
      placeholder={placeholder}
      exporting={exporting}
      onExport={onExport}
    />
  )
}
