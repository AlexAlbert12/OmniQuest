import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video'
import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  createQuestionMediaSignedUrl,
  getQuestionMediaManifest,
  type QuestionMediaType,
} from '../../lib/questionMedia'

export type QuestionMediaProps = {
  questionId?: number | null
  type?: QuestionMediaType | null
  url?: string | null
  path?: string | null
  thumbnailUrl?: string | null
  transcript?: string | null
  subtitlesVtt?: string | null
  altText?: string | null
  caption?: string | null
  compact?: boolean
}

export default function QuestionMedia({
  questionId,
  type,
  url,
  path,
  thumbnailUrl,
  transcript,
  subtitlesVtt,
  altText,
  caption,
  compact = false,
}: QuestionMediaProps) {
  const [source, setSource] = useState(url || null)
  const [resolvedThumbnail, setResolvedThumbnail] = useState(thumbnailUrl || null)
  const [resolvedTranscript, setResolvedTranscript] = useState(transcript || null)
  const [resolvedSubtitles, setResolvedSubtitles] = useState(subtitlesVtt || null)
  const [loading, setLoading] = useState(Boolean(type && (path || questionId) && !isLocalPreviewUrl(url)))
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoadError(null)

    if (!type) {
      setSource(null)
      setLoading(false)
      return () => { active = false }
    }

    if (isLocalPreviewUrl(url)) {
      setSource(url || null)
      setResolvedThumbnail(thumbnailUrl || null)
      setResolvedTranscript(transcript || null)
      setResolvedSubtitles(subtitlesVtt || null)
      setLoading(false)
      return () => { active = false }
    }

    const resolve = async () => {
      setLoading(true)
      try {
        if (questionId) {
          const manifest = await getQuestionMediaManifest(questionId)
          if (!manifest) throw new Error('No tienes acceso al archivo multimedia.')
          if (!active) return
          setSource(manifest.url)
          setResolvedThumbnail(manifest.thumbnailUrl || thumbnailUrl || null)
          setResolvedTranscript(manifest.transcript || transcript || null)
          setResolvedSubtitles(manifest.subtitlesVtt || subtitlesVtt || null)
          return
        }

        if (path) {
          const signedUrl = await createQuestionMediaSignedUrl(path, type)
          if (active) setSource(signedUrl)
          return
        }

        if (url) {
          setSource(url)
          return
        }

        throw new Error('No se encontró el archivo multimedia.')
      } catch (error) {
        if (active) {
          setSource(null)
          setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el archivo multimedia.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void resolve()
    return () => { active = false }
  }, [path, questionId, subtitlesVtt, thumbnailUrl, transcript, type, url])

  if (!type) return null

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#8B7CFF" />
          <Text style={styles.loadingText}>Preparando contenido seguro...</Text>
        </View>
      ) : loadError || !source ? (
        <View style={styles.loadingState}>
          <Ionicons name="shield-outline" size={24} color="#FB7185" />
          <Text style={styles.errorText}>{loadError || 'Contenido multimedia no disponible.'}</Text>
        </View>
      ) : (
        <>
          {type === 'image' ? <ImageMedia url={source} altText={altText} compact={compact} /> : null}
          {type === 'audio' ? <AudioMedia url={source} compact={compact} /> : null}
          {type === 'video' ? (
            <VideoMedia
              url={source}
              thumbnailUrl={resolvedThumbnail}
              subtitlesVtt={resolvedSubtitles}
              compact={compact}
            />
          ) : null}
        </>
      )}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {type === 'audio' && resolvedTranscript ? (
        <TranscriptPanel title="Transcripción del audio" text={resolvedTranscript} />
      ) : null}
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

function VideoMedia({
  url,
  thumbnailUrl,
  subtitlesVtt,
  compact,
}: {
  url: string
  thumbnailUrl?: string | null
  subtitlesVtt?: string | null
  compact: boolean
}) {
  const player = useVideoPlayer({ uri: url, useCaching: true }, (instance) => {
    instance.timeUpdateEventInterval = 0.25
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [started, setStarted] = useState(false)
  const [generatedThumbnail, setGeneratedThumbnail] = useState<VideoThumbnail | null>(null)
  const cues = useMemo(() => parseWebVtt(subtitlesVtt), [subtitlesVtt])
  const activeCue = cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end)

  useEffect(() => {
    const timeSubscription = player.addListener('timeUpdate', ({ currentTime: nextTime }) => {
      setCurrentTime(nextTime)
    })
    const sourceSubscription = player.addListener('sourceLoad', () => {
      if (thumbnailUrl) return
      void player.generateThumbnailsAsync(0.25, { maxWidth: 960, maxHeight: 540 })
        .then(([thumbnail]) => setGeneratedThumbnail(thumbnail || null))
        .catch(() => undefined)
    })
    return () => {
      timeSubscription.remove()
      sourceSubscription.remove()
    }
  }, [player, thumbnailUrl])

  const start = () => {
    setStarted(true)
    player.play()
  }

  const posterSource = thumbnailUrl ? { uri: thumbnailUrl } : generatedThumbnail
  return (
    <View style={[styles.videoFrame, compact && styles.videoCompact]}>
      <VideoView
        accessibilityLabel="Vídeo de la pregunta"
        player={player}
        contentFit="contain"
        allowsFullscreen
        playsInline
        nativeControls={started}
        style={StyleSheet.absoluteFill}
      />
      {!started && posterSource ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reproducir vídeo"
          onPress={start}
          style={StyleSheet.absoluteFill}
        >
          <Image source={posterSource as any} contentFit="cover" style={StyleSheet.absoluteFill} />
          <View style={styles.videoPosterShade}>
            <View style={styles.videoPlayButton}>
              <Ionicons name="play" size={28} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      ) : null}
      {activeCue ? (
        <View style={[styles.subtitleOverlay, { pointerEvents: 'none' }]}>
          <Text style={styles.subtitleText}>{activeCue.text}</Text>
        </View>
      ) : null}
    </View>
  )
}

function TranscriptPanel({ title, text }: { title: string; text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View style={styles.transcriptPanel}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.transcriptHeader}
      >
        <Ionicons name="document-text-outline" size={17} color="#A78BFA" />
        <Text style={styles.transcriptTitle}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#8FA7C7" />
      </Pressable>
      {expanded ? <Text style={styles.transcriptText}>{text}</Text> : null}
    </View>
  )
}

export function parseWebVtt(value?: string | null) {
  if (!value) return [] as { start: number; end: number; text: string }[]
  const normalized = value.replace(/^WEBVTT[^\n]*\n+/i, '').replace(/\r/g, '')
  return normalized.split(/\n{2,}/).flatMap((block) => {
    const lines = block.trim().split('\n')
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) return []
    const [startRaw, endRaw] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const start = parseVttTimestamp(startRaw)
    const end = parseVttTimestamp(endRaw)
    const text = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]+>/g, '').trim()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return []
    return [{ start, end, text }]
  })
}

function parseVttTimestamp(value: string) {
  const parts = value.replace(',', '.').split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return Number.NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return Number.NaN
}

function isLocalPreviewUrl(value?: string | null) {
  return Boolean(value && /^(blob:|data:|file:|content:|ph:)/i.test(value))
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00'
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginTop: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#294873', borderRadius: 20, backgroundColor: '#061426' },
  wrapperCompact: { marginTop: 12, borderRadius: 16 },
  loadingState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  loadingText: { color: '#9FB2CC', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#FB7185', fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '700' },
  image: { width: '100%', height: 300, backgroundColor: '#030B18' },
  imageCompact: { height: 210 },
  videoFrame: { width: '100%', height: 320, overflow: 'hidden', backgroundColor: '#000000' },
  videoCompact: { height: 220 },
  videoPosterShade: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  videoPlayButton: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(109,90,246,0.94)' },
  subtitleOverlay: { position: 'absolute', left: 14, right: 14, bottom: 18, alignItems: 'center' },
  subtitleText: { maxWidth: '94%', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.82)', fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '700' },
  audioCard: { minHeight: 104, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  audioCardCompact: { minHeight: 86, padding: 14 },
  audioButton: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6D5AF6' },
  audioInfo: { minWidth: 0, flex: 1 },
  audioTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 7, marginTop: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: '#1B3152' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#8B7CFF' },
  audioTime: { marginTop: 7, color: '#9FB2CC', fontSize: 11, fontWeight: '700' },
  caption: { paddingHorizontal: 14, paddingVertical: 10, color: '#B9C9DE', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  transcriptPanel: { borderTopWidth: 1, borderTopColor: '#1B3152', paddingHorizontal: 14, paddingVertical: 10 },
  transcriptHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  transcriptTitle: { minWidth: 0, flex: 1, color: '#DDE7F4', fontSize: 12, fontWeight: '800' },
  transcriptText: { paddingBottom: 5, color: '#B9C9DE', fontSize: 12, lineHeight: 19 },
  pressed: { opacity: 0.75 },
})
