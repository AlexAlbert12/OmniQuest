import React from 'react'
import { Image, Pressable, Text } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { PageHeaderRole } from './RolePageHeader'

type HeaderProfile = {
  alias: string | null
  avatar: string | null
}

type RoleHeaderAvatarProps = {
  role: PageHeaderRole
}

/** Shared authenticated avatar used by student and teacher page headers. */
export default function RoleHeaderAvatar({ role }: RoleHeaderAvatarProps) {
  const router = useRouter()
  const [profile, setProfile] = React.useState<HeaderProfile>({ alias: null, avatar: null })

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false

      const loadProfile = async () => {
        const { data: session } = await supabase.auth.getSession()
        const userId = session.session?.user.id
        if (!userId) return

        const { data, error } = await supabase
          .from('profiles')
          .select('alias, avatar')
          .eq('id', userId)
          .single()

        if (!cancelled && !error && data) {
          setProfile({ alias: data.alias ?? null, avatar: data.avatar ?? null })
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
  const destination = role === 'teacher' ? '/(teacher)/profile' : '/(student)/profile'

  return (
    <Pressable
      accessibilityLabel={`Abrir perfil de ${role === 'teacher' ? 'profesor' : 'alumno'}`}
      accessibilityRole="button"
      onPress={() => router.push(destination as any)}
      className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#5B4BC4]"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      {profile.avatar ? (
        <Image source={{ uri: profile.avatar }} className="h-full w-full" />
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
