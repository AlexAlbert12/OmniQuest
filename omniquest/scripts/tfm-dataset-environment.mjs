import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

export function loadTfmDatasetEnvironment() {
  const projectRef = String(process.env.OMNIQUEST_DATASET_PROJECT_REF || process.env.OMNIQUEST_PROJECT_REF || '').trim()
  if (!projectRef) throw new Error('Define OMNIQUEST_DATASET_PROJECT_REF con el Project Ref del proyecto OmniQuest que vas a sanear.')
  const linkedRef = readLinkedProjectRef()
  if (linkedRef !== projectRef) throw new Error(`El proyecto enlazado (${linkedRef || 'sin enlace'}) no coincide con OMNIQUEST_DATASET_PROJECT_REF (${projectRef}).`)
  const serviceRoleKey = String(process.env.OMNIQUEST_TFM_SERVICE_ROLE_KEY || '').trim()
  if (!serviceRoleKey) throw new Error('Define OMNIQUEST_TFM_SERVICE_ROLE_KEY de forma temporal. No la guardes en Git ni la compartas.')
  const url = String(process.env.OMNIQUEST_TFM_SUPABASE_URL || `https://${projectRef}.supabase.co`).trim().replace(/\/$/, '')
  const hostname = new URL(url).hostname.toLowerCase()
  if (!hostname.includes(projectRef.toLowerCase())) throw new Error(`La URL ${url} no parece corresponder al Project Ref ${projectRef}.`)
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  return { projectRef, url, supabase }
}

export function assertApplyConfirmation() {
  if (process.env.OMNIQUEST_TFM_DATASET_CONFIRM !== 'OMNIQUEST') throw new Error('Para aplicar cambios define OMNIQUEST_TFM_DATASET_CONFIRM=OMNIQUEST. El modo dry-run no necesita esta confirmación.')
}

function readLinkedProjectRef() {
  try { return readFileSync(resolve('supabase/.temp/project-ref'), 'utf8').trim() } catch { return '' }
}
