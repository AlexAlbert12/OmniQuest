import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../../lib/color'

export type GalaxyCourseItem = {
  key: string
  title: string
  subtitle: string
  progress: number
  color?: string | null
  icon?: string | null
  badgeLabel: string
  badgeColor: string
  detailColor: string
  onPress: () => void
  onMore?: () => void
}

export type GalaxyTopicState = 'completed' | 'active' | 'available' | 'locked' | 'empty'

export type GalaxyTopicItem = {
  key: string
  title: string
  progress: number
  state: GalaxyTopicState
  actionLabel: string
  color?: string | null
  icon?: string | null
  failedQuestions: number
  questionsCount: number
  bestScore?: number
  onPress: () => void
}

const COURSE_PALETTES = [
  { colors: ['#65F7E2', '#1E9CE8', '#0C4B9B'] as const, rim: '#2DE4CF', glow: '#35E6D0' },
  { colors: ['#FF7A63', '#F5A126', '#9A3F16'] as const, rim: '#FFB32F', glow: '#FF7B58' },
  { colors: ['#C39BFF', '#8155EF', '#382083'] as const, rim: '#9B6CFF', glow: '#8B5CF6' },
  { colors: ['#67D4FF', '#3679E8', '#173E95'] as const, rim: '#58B5FF', glow: '#3B82F6' },
  { colors: ['#6BE7A7', '#1FAD72', '#0D5F49'] as const, rim: '#43D991', glow: '#22C55E' },
  { colors: ['#FF9EB5', '#E75B8D', '#7F2857'] as const, rim: '#FB7185', glow: '#EC4899' },
]

const STAR_POSITIONS: Array<{ left: `${number}%`; top: number; size: number; opacity: number }> = [
  { left: '5%', top: 90, size: 3, opacity: 0.8 },
  { left: '20%', top: 170, size: 2, opacity: 0.55 },
  { left: '61%', top: 126, size: 3, opacity: 0.72 },
  { left: '88%', top: 194, size: 4, opacity: 0.68 },
  { left: '13%', top: 320, size: 4, opacity: 0.52 },
  { left: '48%', top: 375, size: 3, opacity: 0.72 },
  { left: '94%', top: 470, size: 2, opacity: 0.7 },
  { left: '7%', top: 620, size: 4, opacity: 0.5 },
  { left: '72%', top: 710, size: 3, opacity: 0.66 },
  { left: '29%', top: 820, size: 2, opacity: 0.72 },
  { left: '91%', top: 940, size: 4, opacity: 0.55 },
  { left: '52%', top: 1080, size: 3, opacity: 0.76 },
  { left: '8%', top: 1190, size: 2, opacity: 0.72 },
  { left: '81%', top: 1320, size: 3, opacity: 0.64 },
  { left: '24%', top: 1430, size: 4, opacity: 0.52 },
  { left: '62%', top: 1560, size: 2, opacity: 0.7 },
  { left: '94%', top: 1700, size: 3, opacity: 0.62 },
  { left: '15%', top: 1840, size: 3, opacity: 0.55 },
  { left: '46%', top: 1980, size: 4, opacity: 0.5 },
  { left: '83%', top: 2110, size: 2, opacity: 0.72 },
  { left: '7%', top: 2260, size: 3, opacity: 0.6 },
  { left: '67%', top: 2390, size: 4, opacity: 0.5 },
  { left: '35%', top: 2520, size: 2, opacity: 0.7 },
  { left: '92%', top: 2670, size: 3, opacity: 0.55 },
]

export function GalaxyScreenBackground({ height = 2800 }: { height?: number }) {
  const starLayers = Math.max(1, Math.ceil(height / 2700))
  const stars = Array.from({ length: starLayers }, (_, layerIndex) =>
    STAR_POSITIONS.map((star) => ({ ...star, top: star.top + layerIndex * 2700 }))
  ).flat()

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { minHeight: height, overflow: 'hidden' }]}> 
      <LinearGradient
        colors={['#10172C', '#070817', '#020712', '#020A16']}
        locations={[0, 0.28, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.nebula, { width: 420, height: 420, left: -220, top: 40, backgroundColor: '#2B174C', opacity: 0.22 }]} />
      <View style={[styles.nebula, { width: 520, height: 520, right: -300, top: 360, backgroundColor: '#083D50', opacity: 0.22 }]} />
      <View style={[styles.nebula, { width: 540, height: 540, left: -310, top: 1020, backgroundColor: '#25124C', opacity: 0.18 }]} />
      <View style={[styles.nebula, { width: 560, height: 560, right: -330, top: 1650, backgroundColor: '#074A4B', opacity: 0.17 }]} />
      {stars.map((star, index) => (
        <View
          key={`${star.left}-${star.top}-${index}`}
          style={{
            position: 'absolute',
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            borderRadius: 999,
            backgroundColor: index % 4 === 0 ? '#8DD8FF' : '#DCE9FF',
            opacity: star.opacity,
          }}
        />
      ))}
    </View>
  )
}

export function CourseGalaxyMap({
  items,
  inviteCode,
  joining,
  onChangeInviteCode,
  onJoin,
  emptyMessage = 'No hay galaxias que coincidan con los filtros.',
}: {
  items: GalaxyCourseItem[]
  inviteCode: string
  joining: boolean
  onChangeInviteCode: (value: string) => void
  onJoin: () => void
  emptyMessage?: string
}) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1024
  const mapWidth = Math.max(320, Math.min(isDesktop ? width - 390 : width - 30, isDesktop ? 980 : 430))
  const planetSize = isDesktop ? 228 : 188
  const rowHeight = isDesktop ? 340 : 352
  const addRowHeight = 430
  const [joinOpen, setJoinOpen] = useState(false)

  const addTop = items.length === 0 ? 250 : items.length * rowHeight + 24
  const mapHeight = addTop + addRowHeight

  return (
    <View style={{ width: mapWidth, minHeight: mapHeight, alignSelf: 'center', position: 'relative' }}>
      {items.length === 0 ? (
        <View style={{ minHeight: 210, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="planet-outline" size={56} color="#8294B2" />
          <Text style={styles.emptyTitle}>No encontramos cursos</Text>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : null}

      {items.map((item, index) => {
        const side = index % 2 === 0 ? 'right' : 'left'
        const nextSide = (index + 1) % 2 === 0 ? 'right' : 'left'
        const palette = getCoursePalette(item.color, index)
        const x = side === 'left' ? 12 : mapWidth - planetSize - 24
        const nextX = nextSide === 'left' ? 12 : mapWidth - planetSize - 24
        const labelWidth = Math.min(isDesktop ? 390 : 286, mapWidth - 20)
        const labelX = side === 'left' ? 8 : mapWidth - labelWidth - 8
        const connectToAdd = index === items.length - 1
        const addSide = items.length % 2 === 0 ? 'right' : 'left'
        const addSize = isDesktop ? 190 : 156
        const addX = addSide === 'left' ? 24 : mapWidth - addSize - 24
        const targetX = connectToAdd ? addX + addSize / 2 : nextX + planetSize / 2

        return (
          <View key={item.key} style={{ height: rowHeight, position: 'relative' }}>
            <GalaxyDottedConnector
              color="#58BFFF"
              x1={x + planetSize / 2}
              y1={planetSize - 4}
              x2={targetX}
              y2={rowHeight + 34}
              bend={side === 'left' ? 1 : -1}
            />

            <View style={{ position: 'absolute', top: 0, left: x }}>
              <GalaxyPlanet
                size={planetSize}
                palette={palette}
                icon={item.icon}
                label={item.title}
                badgeLabel={item.badgeLabel}
                badgeColor={item.badgeColor}
                onPress={item.onPress}
              />
            </View>

            <View
              style={[
                styles.courseLabelCard,
                {
                  width: labelWidth,
                  left: labelX,
                  top: planetSize + 18,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir curso ${item.title}`}
                onPress={item.onPress}
                style={({ pressed }) => ({ flex: 1, justifyContent: 'center', opacity: pressed ? 0.82 : 1, paddingRight: item.onMore ? 30 : 0 })}
              >
                <Text style={[styles.courseTitle, { textAlign: side === 'left' ? 'left' : 'right' }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.courseSubtitle, { textAlign: side === 'left' ? 'left' : 'right' }]} numberOfLines={2}>
                  <Text style={{ color: item.detailColor, fontWeight: '900' }}>{item.progress}%</Text>
                  {' · '}{item.subtitle}
                </Text>
              </Pressable>
              {item.onMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Más opciones de ${item.title}`}
                  onPress={item.onMore}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    right: 10,
                    top: 10,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(8,13,27,0.7)',
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#AAB8D0" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )
      })}

      <AddCourseGalaxyNode
        top={addTop}
        mapWidth={mapWidth}
        side={items.length % 2 === 0 ? 'right' : 'left'}
        inviteCode={inviteCode}
        joining={joining}
        open={joinOpen}
        onToggle={() => setJoinOpen((current) => !current)}
        onChangeInviteCode={onChangeInviteCode}
        onJoin={onJoin}
      />
    </View>
  )
}

export function TopicGalaxyMap({ items }: { items: GalaxyTopicItem[] }) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1024
  const mapWidth = Math.max(320, Math.min(isDesktop ? width - 260 : width - 24, isDesktop ? 840 : 430))
  const nodeSize = isDesktop ? 178 : 152
  const rowHeight = isDesktop ? 300 : 280
  const mapHeight = Math.max(400, items.length * rowHeight + 80)

  if (items.length === 0) {
    return (
      <View style={{ minHeight: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
        <Ionicons name="planet-outline" size={62} color="#7F91AD" />
        <Text style={styles.emptyTitle}>Aún no hay planetas</Text>
        <Text style={styles.emptyText}>Tu profesor añadirá temas con preguntas para esta galaxia.</Text>
      </View>
    )
  }

  return (
    <View style={{ width: mapWidth, minHeight: mapHeight + 68, paddingTop: 68, alignSelf: 'center', position: 'relative' }}>
      {items.map((item, index) => {
        const side = index % 2 === 0 ? 'center-left' : 'center-right'
        const nextSide = (index + 1) % 2 === 0 ? 'center-left' : 'center-right'
        const x = getTopicNodeX(side, mapWidth, nodeSize, isDesktop)
        const nextX = getTopicNodeX(nextSide, mapWidth, nodeSize, isDesktop)
        const palette = getTopicPalette(item, index)

        return (
          <View key={item.key} style={{ height: rowHeight, position: 'relative' }}>
            {index < items.length - 1 ? (
              <GalaxyDottedConnector
                color="#9F741E"
                x1={x + nodeSize / 2}
                y1={nodeSize - 2}
                x2={nextX + nodeSize / 2}
                y2={rowHeight + 30}
                bend={side === 'center-left' ? 1 : -1}
                dotSize={4}
              />
            ) : null}

            <View style={{ position: 'absolute', left: x, top: 0, alignItems: 'center', width: nodeSize }}>
              {item.state === 'active' ? (
                <View style={styles.startBubble}>
                  <Text style={styles.startBubbleText}>{item.actionLabel.toUpperCase()}</Text>
                  <View style={styles.startBubbleTail} />
                </View>
              ) : null}

              <TopicPlanetButton item={item} palette={palette} size={nodeSize} />

              <View style={{ marginTop: 12, flexDirection: 'row', gap: 5, minHeight: 22 }}>
                {item.state !== 'locked' && item.state !== 'empty'
                  ? [0, 1, 2].map((starIndex) => {
                      const earnedStars = getEarnedStars(item.progress)
                      return (
                        <Ionicons
                          key={starIndex}
                          name="star"
                          size={18}
                          color={starIndex < earnedStars ? palette.rim : '#314250'}
                        />
                      )
                    })
                  : <Ionicons name={item.state === 'locked' ? 'lock-closed' : 'remove-circle'} size={19} color="#60748E" />}
              </View>

              <Text style={styles.topicTitle} numberOfLines={2}>{item.title}</Text>
              {item.failedQuestions > 0 ? (
                <View style={styles.reviewPill}>
                  <Ionicons name="flame" size={13} color="#FFFFFF" />
                  <Text style={styles.reviewPillText}>{item.failedQuestions} para repasar</Text>
                </View>
              ) : typeof item.bestScore === 'number' ? (
                <Text style={styles.topicMeta}>Mejor: {item.bestScore} XP</Text>
              ) : (
                <Text style={styles.topicMeta}>{item.questionsCount} pregunta{item.questionsCount === 1 ? '' : 's'}</Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

function AddCourseGalaxyNode({
  top,
  mapWidth,
  side,
  inviteCode,
  joining,
  open,
  onToggle,
  onChangeInviteCode,
  onJoin,
}: {
  top: number
  mapWidth: number
  side: 'left' | 'right'
  inviteCode: string
  joining: boolean
  open: boolean
  onToggle: () => void
  onChangeInviteCode: (value: string) => void
  onJoin: () => void
}) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 1024
  const size = isDesktop ? 190 : 156
  const x = side === 'left' ? 24 : mapWidth - size - 24
  const formWidth = Math.min(isDesktop ? 420 : 306, mapWidth - 24)
  const formX = side === 'left' ? 12 : mapWidth - formWidth - 12

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top, minHeight: open ? 330 : 260 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Cerrar formulario para añadir curso' : 'Añadir un curso con código'}
        onPress={onToggle}
        style={({ pressed }) => ({ position: 'absolute', left: x, top: 0, width: size, alignItems: 'center', opacity: pressed ? 0.82 : 1 })}
      >
        <View style={[styles.addPlanet, { width: size, height: size, borderRadius: size / 2 }]}> 
          <Ionicons name={open ? 'close' : 'add'} size={isDesktop ? 70 : 58} color="#A96CFF" />
        </View>
        <Text style={styles.addTitle}>Añadir curso</Text>
        <Text style={styles.addSubtitle}>Introduce tu código de clase</Text>
      </Pressable>

      {open ? (
        <View style={[styles.joinPanel, { width: formWidth, left: formX, top: size + 92 }]}> 
          <View style={styles.joinInputRow}>
            <Ionicons name="keypad-outline" size={20} color="#9FB0CA" />
            <TextInput
              value={inviteCode}
              onChangeText={(value) => onChangeInviteCode(value.trim().toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="Código de clase"
              placeholderTextColor="#647896"
              style={styles.joinInput}
              accessibilityLabel="Código de clase"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unirme al curso"
              onPress={onJoin}
              disabled={joining || inviteCode.trim().length === 0}
              style={({ pressed }) => [
                styles.joinButton,
                { opacity: joining || inviteCode.trim().length === 0 ? 0.5 : pressed ? 0.82 : 1 },
              ]}
            >
              {joining ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

function GalaxyPlanet({
  size,
  palette,
  icon,
  label,
  badgeLabel,
  badgeColor,
  onPress,
}: {
  size: number
  palette: { colors: readonly [string, string, string]; rim: string; glow: string }
  icon?: string | null
  label: string
  badgeLabel: string
  badgeColor: string
  onPress: () => void
}) {
  const validIcon = getValidIoniconName(icon)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${label}`}
      onPress={onPress}
      style={({ pressed }) => ({ width: size, height: size, opacity: pressed ? 0.86 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={[styles.planetGlow, { width: size * 0.92, height: size * 0.92, borderRadius: size, left: size * 0.04, top: size * 0.1, shadowColor: palette.glow }]} />
      <View style={[styles.orbitRing, { width: size * 1.55, height: size * 0.33, left: -size * 0.28, top: size * 0.39, borderRadius: size, transform: [{ rotate: '-14deg' }] }]} />
      <View style={[styles.planetRim, { width: size, height: size, borderRadius: size / 2, borderColor: palette.rim }]}> 
        <LinearGradient
          colors={palette.colors}
          locations={[0, 0.52, 1]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={{ width: '100%', height: '100%', borderRadius: size / 2, overflow: 'hidden' }}
        >
          <View style={[styles.planetBand, { width: size * 0.83, height: size * 0.14, borderRadius: size, left: size * 0.08, top: size * 0.38, transform: [{ rotate: '-2deg' }] }]} />
          <View style={[styles.planetBand, { width: size * 0.68, height: size * 0.1, borderRadius: size, left: size * 0.19, top: size * 0.58, opacity: 0.12, transform: [{ rotate: '2deg' }] }]} />
          <LinearGradient
            colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', width: size * 1.35, height: size * 0.42, left: -size * 0.18, top: size * 0.17, transform: [{ rotate: '16deg' }] }}
          />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {validIcon ? (
              <Ionicons name={validIcon} size={Math.round(size * 0.25)} color="rgba(255,255,255,0.82)" />
            ) : icon ? (
              <Text style={{ fontSize: Math.round(size * 0.24), opacity: 0.9 }}>{icon}</Text>
            ) : (
              <Ionicons name="planet" size={Math.round(size * 0.25)} color="rgba(255,255,255,0.78)" />
            )}
          </View>
        </LinearGradient>
      </View>

      <View style={[styles.planetBadge, { backgroundColor: badgeColor }]}> 
        <Ionicons name={badgeLabel === 'Repasar' ? 'flame' : badgeLabel === 'Completado' ? 'checkmark-circle' : 'play'} size={16} color="#FFFFFF" />
        <Text style={styles.planetBadgeText}>{badgeLabel}</Text>
      </View>
    </Pressable>
  )
}

function TopicPlanetButton({
  item,
  palette,
  size,
}: {
  item: GalaxyTopicItem
  palette: { colors: readonly [string, string, string]; rim: string; glow: string }
  size: number
}) {
  const disabled = item.state === 'locked' || item.state === 'empty'
  const validIcon = getValidIoniconName(item.icon)
  const mainIcon: keyof typeof Ionicons.glyphMap = item.state === 'completed'
    ? 'checkmark'
    : item.state === 'locked'
      ? 'lock-closed'
      : item.state === 'empty'
        ? 'remove'
        : 'play'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${getTopicStateLabel(item.state)}`}
      accessibilityState={{ disabled }}
      onPress={item.onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: size,
        height: size,
        opacity: disabled ? 0.58 : pressed ? 0.86 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View style={[styles.planetGlow, { width: size * 0.88, height: size * 0.88, borderRadius: size, left: size * 0.06, top: size * 0.1, shadowColor: palette.glow, opacity: item.state === 'active' ? 0.9 : 0.5 }]} />
      <View style={[styles.topicPlanetOuter, { width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(palette.rim, item.state === 'active' ? '3D' : '24') }]}> 
        <LinearGradient
          colors={palette.colors}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={{ width: size - 16, height: size - 16, borderRadius: (size - 16) / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <View style={[styles.topicPlanetHighlight, { width: size * 0.72, height: size * 0.2, borderRadius: size, top: size * 0.18 }]} />
          {item.state === 'available' && validIcon ? (
            <Ionicons name={validIcon} size={Math.round(size * 0.32)} color="#FFFFFF" />
          ) : item.state === 'available' && item.icon ? (
            <Text style={{ fontSize: Math.round(size * 0.3) }}>{item.icon}</Text>
          ) : (
            <Ionicons name={mainIcon} size={Math.round(size * 0.34)} color={disabled ? '#9FB0C5' : '#FFFFFF'} />
          )}
        </LinearGradient>
      </View>
    </Pressable>
  )
}

function GalaxyDottedConnector({
  color,
  x1,
  y1,
  x2,
  y2,
  bend,
  dotSize = 4,
}: {
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
  bend: 1 | -1
  dotSize?: number
}) {
  const dots = useMemo(() => {
    const count = 22
    const controlX = (x1 + x2) / 2 + bend * Math.min(84, Math.abs(x2 - x1) * 0.25 + 24)
    const controlY = (y1 + y2) / 2

    return Array.from({ length: count }, (_, index) => {
      const t = (index + 1) / (count + 1)
      const oneMinusT = 1 - t
      const x = oneMinusT * oneMinusT * x1 + 2 * oneMinusT * t * controlX + t * t * x2
      const y = oneMinusT * oneMinusT * y1 + 2 * oneMinusT * t * controlY + t * t * y2
      return { x, y }
    })
  }, [bend, x1, x2, y1, y2])

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map((dot, index) => (
        <View
          key={`${dot.x}-${dot.y}-${index}`}
          style={{
            position: 'absolute',
            left: dot.x - dotSize / 2,
            top: dot.y - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize,
            backgroundColor: color,
            opacity: 0.88,
          }}
        />
      ))}
    </View>
  )
}

function getCoursePalette(color: string | null | undefined, index: number) {
  const palette = COURSE_PALETTES[index % COURSE_PALETTES.length]
  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) return palette

  return {
    ...palette,
    rim: color,
    glow: color,
  }
}

function getTopicPalette(item: GalaxyTopicItem, index: number) {
  if (item.state === 'completed') {
    return { colors: ['#58E6D1', '#21B9A1', '#087C73'] as const, rim: '#39E0C4', glow: '#22D3A5' }
  }
  if (item.state === 'active') {
    return { colors: ['#C89CFF', '#8B55F4', '#4B1AA3'] as const, rim: '#A96CFF', glow: '#8B5CF6' }
  }
  if (item.state === 'locked' || item.state === 'empty') {
    return { colors: ['#43516A', '#27354C', '#172237'] as const, rim: '#60748E', glow: '#23364F' }
  }

  const fallback = COURSE_PALETTES[(index + 2) % COURSE_PALETTES.length]
  return item.color && /^#[0-9A-F]{6}$/i.test(item.color)
    ? { ...fallback, rim: item.color, glow: item.color }
    : fallback
}

function getTopicNodeX(side: 'center-left' | 'center-right', mapWidth: number, nodeSize: number, isDesktop: boolean) {
  if (isDesktop) {
    return side === 'center-left'
      ? Math.max(20, mapWidth * 0.24 - nodeSize / 2)
      : Math.min(mapWidth - nodeSize - 20, mapWidth * 0.76 - nodeSize / 2)
  }

  return side === 'center-left'
    ? Math.max(8, mapWidth * 0.34 - nodeSize / 2)
    : Math.min(mapWidth - nodeSize - 8, mapWidth * 0.72 - nodeSize / 2)
}

function getEarnedStars(progress: number) {
  if (progress >= 100) return 3
  if (progress >= 66) return 2
  if (progress > 0) return 1
  return 0
}

function getTopicStateLabel(state: GalaxyTopicState) {
  if (state === 'completed') return 'Completado'
  if (state === 'active') return 'Siguiente tema'
  if (state === 'locked') return 'Bloqueado'
  if (state === 'empty') return 'Sin preguntas'
  return 'Disponible'
}

function getValidIoniconName(icon: string | null | undefined): keyof typeof Ionicons.glyphMap | null {
  if (icon && icon in Ionicons.glyphMap) return icon as keyof typeof Ionicons.glyphMap
  return null
}

const styles = StyleSheet.create({
  nebula: {
    position: 'absolute',
    borderRadius: 999,
  },
  planetGlow: {
    position: 'absolute',
    backgroundColor: 'transparent',
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  orbitRing: {
    position: 'absolute',
    borderWidth: 12,
    borderColor: 'rgba(113,127,170,0.19)',
  },
  planetRim: {
    overflow: 'hidden',
    borderWidth: 7,
    backgroundColor: '#071024',
  },
  planetBand: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  planetBadge: {
    position: 'absolute',
    right: -10,
    top: -8,
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  planetBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  courseLabelCard: {
    position: 'absolute',
    minHeight: 92,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(123,139,169,0.28)',
    backgroundColor: 'rgba(21,25,42,0.89)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  courseTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 22,
    lineHeight: 27,
  },
  courseSubtitle: {
    color: '#BBC8E3',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 5,
  },
  addPlanet: {
    borderWidth: 4,
    borderColor: '#7451A9',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,13,44,0.22)',
  },
  addTitle: {
    marginTop: 18,
    color: '#B476FF',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  addSubtitle: {
    marginTop: 4,
    color: '#B7C2DC',
    fontSize: 15,
    textAlign: 'center',
  },
  joinPanel: {
    position: 'absolute',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#432A70',
    backgroundColor: 'rgba(13,17,36,0.96)',
    padding: 12,
  },
  joinInputRow: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3B5B',
    backgroundColor: '#0A1429',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    overflow: 'hidden',
  },
  joinInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  joinButton: {
    width: 58,
    alignSelf: 'stretch',
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#91A3C0',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    textAlign: 'center',
  },
  startBubble: {
    position: 'absolute',
    zIndex: 10,
    top: -54,
    minHeight: 46,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  startBubbleText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '900',
  },
  startBubbleTail: {
    position: 'absolute',
    bottom: -9,
    width: 18,
    height: 18,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  topicPlanetOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicPlanetHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ rotate: '-7deg' }],
  },
  topicTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
    width: 210,
  },
  topicMeta: {
    color: '#AAB8D0',
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  reviewPill: {
    marginTop: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#DD365E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reviewPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
})
