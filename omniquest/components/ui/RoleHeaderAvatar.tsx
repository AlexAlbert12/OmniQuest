import React from 'react'
import { Image, Pressable, Text } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getRenderableAvatarUri } from '../../lib/avatarUri'
import type { PageHeaderRole } from './RolePageHeader'
import GamifiedAvatar from '../gamification/GamifiedAvatar'
import { useProfileCosmetics } from '../../hooks/useProfileCosmetics'
import { getStudentLevel } from '../../lib/studentLevel'

type HeaderProfile = {
  alias: string | null
  avatar: string | null
  points: number | null
}

type RoleHeaderAvatarProps = {
  role: PageHeaderRole
}

export default function RoleHeaderAvatar({ role }: RoleHeaderAvatarProps) {
  const router = useRouter()
  const [profile, setProfile] = React.useState<HeaderProfile>({ alias: null, avatar: null, points: 0 })
  const { cosmetics } = useProfileCosmetics()

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false

      const loadProfile = async () => {
        const { data: session } = await supabase.auth.getSession()
        const userId = session.session?.user.id
        if (!userId) return

        const { data, error } = await supabase
          .from('profiles')
          .select('alias, avatar, points')
          .eq('id', userId)
          .single()

        if (!cancelled && !error && data) {
          setProfile({ alias: data.alias ?? null, avatar: data.avatar ?? null, points: data.points ?? 0 })
        }
      }

      void loadProfile()
      return () => {
        cancelled = true
      }
    }, [])
  )

  const fallbackAlias = role === 'teacher' ? 'Profesor' : 'Alumno'
  const alias = profile.alias || fallbackAlias
  const avatarUri = getRenderableAvatarUri(profile.avatar)
  const destination = role === 'teacher' ? '/(teacher)/profile' : '/(student)/profile'

  if (role === 'student') {
    return (
      <GamifiedAvatar
        alias={alias}
        avatarUrl={avatarUri}
        cosmetics={cosmetics}
        level={getStudentLevel(profile.points ?? 0)}
        onPress={() => router.push(destination as any)}
        showLevel={false}
        size={46}
      />
    )
  }

  return (
    <Pressable
      accessibilityLabel={`Abrir perfil de ${role === 'teacher' ? 'profesor' : 'alumno'}`}
      accessibilityRole="button"
      onPress={() => router.push(destination as any)}
      className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-student"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} className="h-full w-full" />
      ) : (
        <Text className="font-black text-white">{getInitials(alias)}</Text>
      )}
    </Pressable>
  )
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2)
  const initials = parts.map((part) => part[0]?.toUpperCase()).join('')
  return initials || 'O'
}
