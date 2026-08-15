import { supabase } from './supabase'

export const CURRENT_ONBOARDING_VERSION = 1

export type OnboardingRole = 'student' | 'teacher'
export type OnboardingProfile = {
  role_id: string | null
  onboarding_version?: number | null
  onboarding_completed_at?: string | null
}

export function getOnboardingRouteForRole(role: OnboardingRole) {
  return role === 'teacher' ? '/(teacher)/onboarding' : '/(student)/onboarding'
}

export function getHomeRouteForOnboardingRole(role: OnboardingRole) {
  return role === 'teacher' ? '/(teacher)/homeTeacher' : '/(student)/homeStudent'
}

export function getHelpRouteForOnboardingRole(role: OnboardingRole) {
  return role === 'teacher' ? '/(teacher)/help-center' : '/(student)/help-center'
}

export function profileNeedsOnboarding(profile: OnboardingProfile) {
  if (profile.role_id !== 'student' && profile.role_id !== 'teacher') return false
  if (typeof profile.onboarding_version !== 'number') return false
  return profile.onboarding_version < CURRENT_ONBOARDING_VERSION
}

export async function completeCurrentUserOnboarding() {
  const { data, error } = await supabase.rpc('complete_current_user_onboarding', { p_version: CURRENT_ONBOARDING_VERSION })
  if (error) throw error
  return data?.[0] ?? null
}
