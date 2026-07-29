import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import AvatarCustomizationModal from '../../gamification/AvatarCustomizationModal'
import {
  DEFAULT_AVATAR_FRAME,
  fetchAvatarCustomizationOptions,
  type AvatarCustomizationOptions,
  type ProfileCosmetics,
} from '../../../lib/avatarCosmetics'
import { enqueueOfflineMutation, stageAvatarForOffline } from '../../../lib/offlineMutations'
import { getNetworkAvailability } from '../../../lib/gameOffline'
import { supabase } from '../../../lib/supabase'
import { useAppModal } from '../../AppModalProvider'
import type { StudentProfile } from '../../../hooks/student/useStudentProfile'

type Props = {
  visible: boolean
  profile: StudentProfile | null
  alias: string
  level: number
  cosmetics: ProfileCosmetics
  options: AvatarCustomizationOptions | null
  awardedBadgeIds: string[]
  onClose: () => void
  onAvatarSaved: (avatar: string | null) => void | Promise<void>
  onOptionsSaved: (options: AvatarCustomizationOptions) => void | Promise<void>
}

export default function StudentAvatarCustomizationModal({
  visible,
  profile,
  alias,
  level,
  cosmetics,
  options,
  awardedBadgeIds,
  onClose,
  onAvatarSaved,
  onOptionsSaved,
}: Props) {
  const { showModal } = useAppModal()
  const [currentOptions, setCurrentOptions] = useState<AvatarCustomizationOptions | null>(options)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCurrentOptions(options)
  }, [options])

  useEffect(() => {
    if (!visible) return
    let mounted = true
    void fetchAvatarCustomizationOptions()
      .then((nextOptions) => {
        if (mounted) setCurrentOptions(nextOptions)
      })
      .catch((error) => console.warn('No se pudo actualizar la personalización del avatar:', error))
    return () => { mounted = false }
  }, [visible])

  const pickImage = async () => {
    if (!profile) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      showModal({
        title: 'Permiso requerido',
        message: 'Necesitamos acceso a tu galería para cambiar la foto del avatar.',
        variant: 'warning',
      })
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) await uploadImage(result.assets[0].uri)
  }

  const uploadImage = async (uri: string) => {
    if (!profile) return
    setBusy(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('No hay sesión activa.')

      if (Platform.OS !== 'web') {
        const localUri = await stageAvatarForOffline(userId, uri)
        await enqueueOfflineMutation({
          userId,
          kind: 'profile.avatar',
          entityKey: 'profile:avatar',
          conflictPolicy: 'client_wins',
          payload: { localUri },
        })
        await onAvatarSaved(localUri)
        showModal({
          title: 'Foto guardada',
          message: 'La imagen se subirá automáticamente cuando haya conexión.',
          variant: 'success',
        })
        return
      }

      if (!await getNetworkAvailability()) throw new Error('En web necesitas conexión para subir una foto nueva.')
      const response = await fetch(uri)
      const blob = await response.blob()
      const fileName = `${profile.id}.jpg`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true })
      if (uploadError) throw uploadError

      const { data, error: updateError } = await supabase.functions.invoke('profile-update-avatar', {
        body: { avatarPath: fileName },
      })
      if (updateError) throw updateError
      if (data?.error) throw new Error(String(data.error))

      await onAvatarSaved(data?.avatar || null)
      showModal({ title: 'Avatar actualizado', message: 'Tu nueva imagen ya está disponible.', variant: 'success' })
    } catch (error) {
      showModal({
        title: 'No se pudo actualizar el avatar',
        message: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const saveCustomization = async ({
    frameKey,
    featuredBadgeId,
  }: {
    frameKey: string | null
    featuredBadgeId: string | null
  }) => {
    if (!profile) return
    setBusy(true)

    try {
      const selectedFrame = currentOptions?.frames.find((frame) => frame.key === frameKey)
        || currentOptions?.cosmetics.frame
        || DEFAULT_AVATAR_FRAME
      const nextCosmetics: ProfileCosmetics = { frame: selectedFrame, featuredBadgeId }

      await enqueueOfflineMutation({
        userId: profile.id,
        kind: 'profile.cosmetics',
        entityKey: 'profile:cosmetics',
        conflictPolicy: 'client_wins',
        payload: { frameKey, featuredBadgeId },
      })

      const nextOptions: AvatarCustomizationOptions = currentOptions
        ? { ...currentOptions, cosmetics: nextCosmetics }
        : {
            level,
            frames: [selectedFrame],
            awardedBadgeIds,
            cosmetics: nextCosmetics,
          }

      setCurrentOptions(nextOptions)
      await onOptionsSaved(nextOptions)
      onClose()
    } catch (error) {
      showModal({
        title: 'No se pudo guardar',
        message: error instanceof Error ? error.message : 'Revisa los requisitos del marco e inténtalo de nuevo.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AvatarCustomizationModal
      alias={alias}
      avatarUrl={profile?.avatar}
      awardedBadgeIds={currentOptions?.awardedBadgeIds || awardedBadgeIds}
      busy={busy}
      cosmetics={currentOptions?.cosmetics || cosmetics}
      frames={currentOptions?.frames || [DEFAULT_AVATAR_FRAME]}
      level={currentOptions?.level || level}
      onChangePhoto={() => void pickImage()}
      onClose={onClose}
      onSave={saveCustomization}
      visible={visible}
    />
  )
}
