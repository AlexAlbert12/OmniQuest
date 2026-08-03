import { supabase } from '../../lib/supabase'
import type { StudentProgressSummary } from './types'

export async function fetchStudentProgressSummary(_userId?: string): Promise<StudentProgressSummary> {
  const { data, error } = await supabase.rpc('get_student_progress_summary')
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El servidor devolvió un resumen de progreso no válido.')
  return data as unknown as StudentProgressSummary
}
