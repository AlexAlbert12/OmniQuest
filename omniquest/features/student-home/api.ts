import { supabase } from '../../lib/supabase'
import type { StudentHomeDashboardPayload } from './types'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export async function fetchStudentHomeDashboard(): Promise<StudentHomeDashboardPayload> {
  const { data, error } = await supabase.rpc('get_student_home_dashboard')
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El servidor devolvió un resumen de inicio no válido.')
  return data as unknown as StudentHomeDashboardPayload
}

export async function signOutStudent() {
  const { error } = await signOutCurrentDeviceSession()
  if (error) throw error
}
