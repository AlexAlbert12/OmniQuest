import { requestAdminExportJob } from '@/components/admin/api/adminApi'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
    storage: { from: jest.fn() },
  },
}))

const mockRpc = supabase.rpc as jest.Mock

describe('requestAdminExportJob', () => {
  beforeEach(() => mockRpc.mockReset())

  it('sends a JSON-safe filter DTO to the aggregate RPC', async () => {
    const response = { id: 'job-1', export_type: 'audit', status: 'queued' }
    mockRpc.mockResolvedValue({ data: response, error: null })

    await expect(requestAdminExportJob('audit', {
      severity: 'high',
      include_archived: false,
      course_ids: [10, 11],
      date_from: null,
    })).resolves.toEqual(response)

    expect(mockRpc).toHaveBeenCalledWith('request_admin_export_job', {
      p_export_type: 'audit',
      p_filters: {
        severity: 'high',
        include_archived: false,
        course_ids: [10, 11],
        date_from: null,
      },
    })
  })

  it('propagates RPC errors to the feedback layer', async () => {
    const error = new Error('RPC unavailable')
    mockRpc.mockResolvedValue({ data: null, error })

    await expect(requestAdminExportJob('audit', {})).rejects.toBe(error)
  })
})
