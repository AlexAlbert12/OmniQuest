import { supabase } from './supabase'

export type AvatarFrameRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type AvatarFrame = {
  key: string
  name: string
  description: string | null
  primaryColor: string
  secondaryColor: string
  rarity: AvatarFrameRarity
  minimumLevel: number
  requiredBadgeId: string | null
  unlocked: boolean
  lockedReason: string | null
}

export type ProfileCosmetics = {
  userId?: string
  frame: AvatarFrame | null
  featuredBadgeId: string | null
}

export type AvatarCustomizationOptions = {
  level: number
  frames: AvatarFrame[]
  awardedBadgeIds: string[]
  cosmetics: ProfileCosmetics
}

type RpcFrame = {
  frame_key?: string
  name?: string
  description?: string | null
  primary_color?: string
  secondary_color?: string | null
  rarity?: string
  minimum_level?: number
  required_badge_id?: string | null
  unlocked?: boolean
  locked_reason?: string | null
}

type RpcCosmeticsRow = RpcFrame & {
  user_id?: string
  featured_badge_id?: string | null
}

export const DEFAULT_AVATAR_FRAME: AvatarFrame = {
  key: 'explorer',
  name: 'Explorador',
  description: 'El marco inicial de todo aventurero de OmniQuest.',
  primaryColor: '#58B5FF',
  secondaryColor: '#7C5CFF',
  rarity: 'common',
  minimumLevel: 1,
  requiredBadgeId: null,
  unlocked: true,
  lockedReason: null,
}

function normalizeFrame(row: RpcFrame | null | undefined): AvatarFrame | null {
  if (!row?.frame_key) return null
  const rarity = ['common', 'rare', 'epic', 'legendary'].includes(String(row.rarity))
    ? row.rarity as AvatarFrameRarity
    : 'common'

  return {
    key: row.frame_key,
    name: row.name || 'Marco',
    description: row.description ?? null,
    primaryColor: row.primary_color || '#58B5FF',
    secondaryColor: row.secondary_color || row.primary_color || '#7C5CFF',
    rarity,
    minimumLevel: Math.max(1, Number(row.minimum_level || 1)),
    requiredBadgeId: row.required_badge_id ?? null,
    unlocked: row.unlocked !== false,
    lockedReason: row.locked_reason ?? null,
  }
}

export async function fetchAvatarCustomizationOptions(): Promise<AvatarCustomizationOptions> {
  const { data, error } = await supabase.rpc('get_avatar_customization_options')
  if (error) throw error

  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as {
        level?: number
        frames?: RpcFrame[]
        awarded_badge_ids?: string[]
        cosmetics?: RpcCosmeticsRow | null
      }
    : {}
  const cosmeticsRow = payload.cosmetics ?? null

  return {
    level: Math.max(1, Number(payload.level || 1)),
    frames: Array.isArray(payload.frames)
      ? payload.frames.map(normalizeFrame).filter((frame): frame is AvatarFrame => Boolean(frame))
      : [DEFAULT_AVATAR_FRAME],
    awardedBadgeIds: Array.isArray(payload.awarded_badge_ids)
      ? payload.awarded_badge_ids.filter((id): id is string => typeof id === 'string')
      : [],
    cosmetics: {
      frame: normalizeFrame(cosmeticsRow) || DEFAULT_AVATAR_FRAME,
      featuredBadgeId: cosmeticsRow?.featured_badge_id ?? null,
    },
  }
}

export async function equipProfileCosmetics({
  frameKey,
  featuredBadgeId,
}: {
  frameKey: string | null
  featuredBadgeId: string | null
}): Promise<ProfileCosmetics> {
  const { data, error } = await supabase.rpc('equip_profile_cosmetics', {
    p_frame_key: frameKey ?? undefined,
    p_featured_badge_id: featuredBadgeId ?? undefined,
  })

  if (error) throw error
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as RpcCosmeticsRow
    : {}

  return {
    frame: normalizeFrame(payload) || DEFAULT_AVATAR_FRAME,
    featuredBadgeId: payload.featured_badge_id ?? null,
  }
}

export async function fetchProfileCosmeticsForUsers(userIds: string[]): Promise<Map<string, ProfileCosmetics>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return new Map()

  const { data, error } = await supabase.rpc('get_profile_cosmetics', {
    p_user_ids: uniqueUserIds,
  })

  if (error) throw error
  const rows = Array.isArray(data) ? data as RpcCosmeticsRow[] : []

  return new Map(rows.flatMap((row) => {
    if (!row.user_id) return []
    return [[row.user_id, {
      userId: row.user_id,
      frame: normalizeFrame(row) || DEFAULT_AVATAR_FRAME,
      featuredBadgeId: row.featured_badge_id ?? null,
    } satisfies ProfileCosmetics] as const]
  }))
}

export async function fetchOwnProfileCosmetics(): Promise<ProfileCosmetics> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) return { frame: DEFAULT_AVATAR_FRAME, featuredBadgeId: null }

  const map = await fetchProfileCosmeticsForUsers([userId])
  return map.get(userId) || { userId, frame: DEFAULT_AVATAR_FRAME, featuredBadgeId: null }
}
