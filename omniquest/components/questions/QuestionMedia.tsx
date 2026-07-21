import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import type { QuestionMediaType } from '../../lib/questionMedia'

export type QuestionMediaProps = {
  type?: QuestionMediaType | null
  url?: string | null
  altText?: string | null
  caption?: string | null
  compact?: boolean
}

export default function QuestionMedia({ type, url, altText, caption, compact = false }: QuestionMediaProps) {
  if (!type || !url) return null

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      {type === 'image' ? <ImageMedia url={url} altText={altText} compact={compact} /> : null}
      {type === 'audio' ? <AudioMedia url={url} compact={compact} /> : null}
      {type === 'video' ? <VideoMedia url={url} compact={compact} /> : null}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  )
}

function ImageMedia({ url, altText, compact }: { url: string; altText?: string | null; compact: boolean }) {
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={altText || 'Imagen de la pregunta'}
      contentFit="contain"
      transition={180}
      style={[styles.image, compact && styles.imageCompact]}
    />
  )
}

function AudioMedia({ url, compact }: { url: string; compact: boolean }) {
  const player = useAudioPlayer(url, { downloadFirst: true })
  const status = useAudioPlayerStatus(player)
  const isPlaying = status.playing
  const duration = Math.max(0, status.duration || 0)
  const current = Math.max(0, status.currentTime || 0)

  const toggle = () => {
    if (isPlaying) {
      player.pause()
      return
    }
    if (duration > 0 && current >= duration - 0.1) player.seekTo(0)
    player.play()
  }

  return (
    <View style={[styles.audioCard, compact && styles.audioCardCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
        hitSlop={8}
        onPress={toggle}
        style={({ pressed }) => [styles.audioButton, pressed && styles.pressed]}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#FFFFFF" />
      </Pressable>
      <View style={styles.audioInfo}>
        <Text style={styles.audioTitle}>Audio de la pregunta</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${duration > 0 ? Math.min(100, (current / duration) * 100) : 0}%` }]} />
        </View>
        <Text style={styles.audioTime}>{formatTime(current)} / {formatTime(duration)}</Text>
      </View>
    </View>
  )
}

function VideoMedia({ url, compact }: { url: string; compact: boolean }) {
  const player = useVideoPlayer({ uri: url, useCaching: true })
  return (
    <VideoView
      accessibilityLabel="Vídeo de la pregunta"
      player={player}
      contentFit="contain"
      allowsFullscreen
      playsInline
      nativeControls
      style={[styles.video, compact && styles.videoCompact]}
    />
  )
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00'
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginTop: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#294873',
    borderRadius: 20,
    backgroundColor: '#061426',
  },
  wrapperCompact: {
    marginTop: 12,
    borderRadius: 16,
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#030B18',
  },
  imageCompact: {
    height: 210,
  },
  video: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
  },
  videoCompact: {
    height: 220,
  },
  audioCard: {
    minHeight: 104,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  audioCardCompact: {
    minHeight: 86,
    padding: 14,
  },
  audioButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6D5AF6',
  },
  audioInfo: {
    minWidth: 0,
    flex: 1,
  },
  audioTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  progressTrack: {
    height: 7,
    marginTop: 10,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#1B3152',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#8B7CFF',
  },
  audioTime: {
    marginTop: 7,
    color: '#9FB2CC',
    fontSize: 11,
    fontWeight: '700',
  },
  caption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#B9C9DE',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
})
