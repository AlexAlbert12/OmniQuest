import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  DEFAULT_AVATAR_FRAME,
  fetchOwnProfileCosmetics,
  type ProfileCosmetics,
} from '../lib/avatarCosmetics'

const DEFAULT_COSMETICS: ProfileCosmetics = {
  frame: DEFAULT_AVATAR_FRAME,
  featuredBadgeId: null,
}

export function useProfileCosmetics() {
  const [cosmetics, setCosmetics] = useState<ProfileCosmetics>(DEFAULT_COSMETICS)

  const refresh = useCallback(async () => {
    try {
      setCosmetics(await fetchOwnProfileCosmetics())
    } catch (error) {
      console.warn('No se pudieron cargar los cosméticos del perfil:', error)
      setCosmetics(DEFAULT_COSMETICS)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )

  return { cosmetics, refresh, setCosmetics }
}
