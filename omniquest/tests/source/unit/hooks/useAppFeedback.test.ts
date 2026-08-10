import { act, renderHook } from '@testing-library/react-native'
import { Alert, Platform } from 'react-native'
import { useAppToast } from '@/components/ui/AppToast'
import { useAppFeedback } from '@/hooks/useAppFeedback'

jest.mock('@/components/ui/AppToast', () => ({
  useAppToast: jest.fn(),
}))

jest.mock('@/lib/i18n', () => ({
  translateUiText: (_locale: string, input: string) => input,
  useI18n: () => ({ locale: 'es-ES' }),
}))

const mockUseAppToast = useAppToast as jest.Mock
const mockShowToast = jest.fn()

describe('useAppFeedback', () => {
  beforeEach(() => {
    mockShowToast.mockClear()
    mockUseAppToast.mockReturnValue({ showToast: mockShowToast })
  })

  it('normalizes success, error and warning messages through one toast service', () => {
    const { result } = renderHook(() => useAppFeedback())

    act(() => {
      result.current.success('Guardado', 'Cambios aplicados')
      result.current.error('Error', new Error('Sin conexión'))
      result.current.warning('Atención')
    })

    expect(mockShowToast).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'Guardado', message: 'Cambios aplicados', variant: 'success' }))
    expect(mockShowToast).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'Error', message: 'Sin conexión', variant: 'danger' }))
    expect(mockShowToast).toHaveBeenNthCalledWith(3, expect.objectContaining({ title: 'Atención', variant: 'warning' }))
  })

  it('resolves native confirmations from the selected alert action', async () => {
    const originalPlatform = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const { result } = renderHook(() => useAppFeedback())

    let confirmation!: Promise<boolean>
    act(() => {
      confirmation = result.current.confirm({ title: 'Eliminar', message: 'Esta acción no se puede deshacer.', destructive: true })
    })
    const buttons = alert.mock.calls[0]?.[2]
    act(() => buttons?.[1]?.onPress?.())

    await expect(confirmation).resolves.toBe(true)
    alert.mockRestore()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })
})
