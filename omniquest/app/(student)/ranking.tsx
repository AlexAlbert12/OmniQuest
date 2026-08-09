import React from 'react'
import { RefreshControl, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { formatCount } from '../../lib/formatCount'
import { useAppTheme } from '../../lib/appTheme'
import StudentLayout from '../../components/student/StudentLayout'
import StudentPageHeader from '../../components/student/StudentPageHeader'
import PaginationControls from '../../components/ui/PaginationControls'
import AppDropdown from '../../components/ui/AppDropdown'
import AppStatusBanner from '../../components/ui/AppStatusBanner'
import {
  CurrentPositionCard,
  LeagueCarousel,
  RankingMobileList,
  RankingTable,
  RankingTabs,
} from '../../components/student/ranking'
import { useStudentRanking } from '../../hooks/student/useStudentRanking'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export default function RankingScreen() {
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const isDesktop = width >= 1024
  const pageSize = isDesktop ? 12 : 6
  const ranking = useStudentRanking(pageSize)
  const profilePoints = ranking.profile?.points ?? 0
  const selectedClass = ranking.classOptions.find((option) => option.classroomId === ranking.selectedClassroomId) || null
  const emptyMessage = getEmptyMessage({
    scope: ranking.scope,
    hasClasses: ranking.classOptions.length > 0,
    selectedClassName: selectedClass ? `${selectedClass.name} · ${selectedClass.classroomName}` : null,
    selectedLeagueName: ranking.selectedLeagueName,
  })

  return (
    <StudentLayout
      activeSection="ranking"
      bottomNavActive="ranking"
      alias={ranking.profile?.alias || 'Alumno'}
      avatar={ranking.profile?.avatar}
      isDesktop={isDesktop}
      loading={ranking.loading}
      loadingLabel="Actualizando ranking..."
      level={getStudentLevel(profilePoints)}
      points={profilePoints}
      nextLevelProgress={getNextLevelProgress(profilePoints)}
      onSignOut={() => { void signOutCurrentDeviceSession() }}
      refreshControl={<RefreshControl refreshing={ranking.refreshing} onRefresh={ranking.reload} tintColor={tokens.brand.student} />}
    >
      <StudentPageHeader icon="trophy" isDesktop={isDesktop} subtitle="Compite con privacidad y reglas de clasificación transparentes." title="Ranking" />

      {ranking.error ? (
        <View className="mt-4">
          <AppStatusBanner variant="danger" title="No se pudo actualizar el ranking" message={ranking.error} />
        </View>
      ) : null}

      <View className="mt-4 gap-4">
        <CurrentPositionCard
          profile={ranking.profile}
          current={ranking.current}
          rank={ranking.currentRank}
          total={ranking.rankingTotal}
          points={ranking.currentPoints}
          league={ranking.currentLeague}
          participates={ranking.participates}
          isGuest={ranking.isGuest}
        />

        <RankingTabs value={ranking.scope} onChange={ranking.setScope} />

        {ranking.scope === 'class' ? (
          <AppDropdown
            label="Clase del ranking"
            value={ranking.selectedClassroomId}
            placeholder={ranking.classOptions.length ? 'Selecciona una clase' : 'No tienes clases disponibles'}
            disabled={ranking.classOptions.length === 0}
            options={ranking.classOptions.map((option) => ({
              value: option.classroomId,
              label: `${option.name} · ${option.classroomName}`,
              description: option.classroomCode ? `Código ${option.classroomCode}` : option.description || undefined,
              icon: getClassIcon(option.icon),
            }))}
            onChange={ranking.setSelectedClassroomId}
          />
        ) : null}

        <LeagueCarousel
          leagues={ranking.leagues}
          currentLeague={ranking.currentLeague}
          selectedLeague={ranking.selectedLeague}
          points={ranking.currentPoints}
          onSelect={(league) => ranking.setSelectedLeagueName(league?.name ?? null)}
        />

        <View>
          <View className="mb-3 flex-row flex-wrap items-end justify-between gap-3">
            <View className="min-w-[220px] flex-1">
              <Text className="text-[19px] font-black text-text-primary">Clasificación</Text>
              <Text className="mt-1 text-[12px] leading-5 text-text-secondary">
                {ranking.selectedLeague ? `Filtrada por la liga ${ranking.selectedLeague.name}.` : 'Incluye todas las ligas del ámbito seleccionado.'}
              </Text>
            </View>
            <Text className="text-[12px] font-black text-text-muted">{formatCount(ranking.total, 'participante', 'participantes')}</Text>
          </View>

          {isDesktop ? (
            <RankingTable rows={ranking.rows} currentUserId={ranking.profile?.id} emptyMessage={emptyMessage} />
          ) : (
            <RankingMobileList rows={ranking.rows} currentUserId={ranking.profile?.id} emptyMessage={emptyMessage} />
          )}

          <PaginationControls
            compact={!isDesktop}
            page={ranking.page}
            pageSize={ranking.pageSize}
            total={ranking.total}
            onPrevious={() => ranking.setPage(Math.max(0, ranking.page - 1))}
            onNext={() => ranking.setPage(ranking.page + 1)}
          />
        </View>
      </View>
    </StudentLayout>
  )
}

function getEmptyMessage({ scope, hasClasses, selectedClassName, selectedLeagueName }: {
  scope: string
  hasClasses: boolean
  selectedClassName: string | null
  selectedLeagueName: string | null
}) {
  const leagueSuffix = selectedLeagueName ? ` en la liga ${selectedLeagueName}` : ''
  if (scope === 'weekly') return `Aún no hay XP ganado esta semana${leagueSuffix}.`
  if (scope === 'global') return `Aún no hay estudiantes en el ranking global${leagueSuffix}.`
  if (!hasClasses) return 'Todavía no perteneces a ninguna clase.'
  if (!selectedClassName) return 'Selecciona una clase para consultar su ranking.'
  return `Aún no hay alumnado clasificado en ${selectedClassName}${leagueSuffix}.`
}

function getClassIcon(icon: string | null): keyof typeof Ionicons.glyphMap {
  return icon && icon in Ionicons.glyphMap ? icon as keyof typeof Ionicons.glyphMap : 'people-outline'
}
