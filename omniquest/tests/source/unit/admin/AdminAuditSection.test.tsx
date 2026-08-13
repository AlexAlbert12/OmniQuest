import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { AppThemeProvider } from '@/lib/appTheme'
import AdminAuditPage from '@/app/(admin)/audit'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/lib/responsive', () => ({
  useResponsiveLayout: () => ({
    width: 1280,
    height: 800,
    breakpoint: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isWide: false,
    horizontalPadding: 28,
    verticalPadding: 24,
    contentMaxWidth: 1320,
    columns: 3,
  }),
}))

jest.mock('@/lib/i18n', () => ({
  translateUiText: (_locale: string, value: string) => value,
  useI18n: () => ({ locale: 'es-ES', t: (key: string) => key }),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(async (name: string) => name === 'get_admin_audit_policy'
      ? { data: { retention_months: 24, append_only: true, strong_integrity: true }, error: null }
      : { data: [], error: null }),
  },
}))

jest.mock('@/hooks/useAppFeedback', () => ({
  useAppFeedback: () => ({
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  }),
}))

jest.mock('@/components/admin/hooks/useAdminData', () => ({
  useAdminData: () => ({
    version: 0,
    profiles: [],
    portalContext: {
      permissions: ['audit.read', 'audit.export'],
      role_id: 'global-admin',
      role_name: 'Administrador global',
    },
  }),
}))

jest.mock('@/components/admin/hooks/useAdminExportJobs', () => ({
  useAdminExportJobs: () => ({ loading: false, request: jest.fn() }),
}))

jest.mock('@/components/admin/hooks/useAdminRpcPage', () => ({
  useAdminRpcPage: () => ({
    rows: [{
      id: 1,
      admin_id: 'admin-id',
      action: 'profile.update',
      target_table: 'profiles',
      target_id: 'student-id',
      created_at: '2026-08-12T10:00:00.000Z',
      before_state: { active: false },
      after_state: { active: true },
      metadata: {},
      severity: 'info',
      chain_seq: 1,
      chain_hash: 'hash',
      previous_hash: null,
      retention_until: null,
      actor_alias: 'Admin',
      actor_email: 'admin@example.com',
      total_count: 1,
    }],
    page: 0,
    pageSize: 25,
    total: 1,
    loading: false,
    refreshing: false,
    hasPrevious: false,
    hasNext: false,
    previousPage: jest.fn(),
    nextPage: jest.fn(),
  }),
}))

jest.mock('@/components/admin/shared/AdminScaffold', () => {
  return { AdminScaffold: ({ children }: { children: React.ReactNode }) => children }
})

describe('AdminAuditPage', () => {
  it('renders the complete audit route without undefined element types', async () => {
    const screen = render(
      <AppThemeProvider>
        <AdminAuditPage />
      </AppThemeProvider>,
    )

    await waitFor(() => expect(screen.getByText('Registro de auditoría')).toBeTruthy())
    expect(screen.getByText('Admin')).toBeTruthy()
    expect(screen.getByText('Detalles')).toBeTruthy()
  }, 15_000)
})
