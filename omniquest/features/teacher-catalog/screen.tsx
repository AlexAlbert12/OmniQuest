import OmniLoadingScreen from '../../components/ui/OmniLoadingScreen'
import React, { useCallback, useState } from 'react'
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import TeacherSidebar from '../../components/teacher/TeacherSidebar'
import TeacherBottomNav from '../../components/teacher/TeacherBottomNav'
import TeacherPageHeader from '../../components/teacher/TeacherPageHeader'
import TeacherScreenLayout from '../../components/layouts/TeacherScreenLayout'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { useResponsiveLayout } from '../../lib/responsive'
import AppButton from '../../components/ui/AppButton'
import AppDropdown from '../../components/ui/AppDropdown'
import AppTabs from '../../components/ui/AppTabs'
import PaginationControls from '../../components/ui/PaginationControls'
import TeacherCourseCard from '../../components/teacher/classes/TeacherCourseCard'
import TeacherClassroomCard from '../../components/teacher/classes/TeacherClassroomCard'
import CreateCourseCTA from '../../components/teacher/classes/CreateCourseCTA'
import { useAppModal } from '../../components/AppModalProvider'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { signOutTeacherCatalog } from './api'
import { restoreTeacherSubject } from '../teacher-subject/api'
import { teacherCourseFilters, teacherCourseSorts, type TeacherCatalogCourseItem, type TeacherCatalogItem, type TeacherCatalogTab, type TeacherCourseFilter, type TeacherCourseSort } from './types'
import { useTeacherCatalog } from './useTeacherCatalog'

export default function TeacherClassesScreen() {
  const responsive = useResponsiveLayout()
  const router = useRouter()
  const isDesktop = responsive.isDesktop
  const pageSize = isDesktop ? 12 : 6
  const catalog = useTeacherCatalog(pageSize)
  const { showModal } = useAppModal()
  const feedback = useAppFeedback()
  const [restoringCourseId, setRestoringCourseId] = useState<number | null>(null)
  const viewingArchived = catalog.catalogTab === 'courses' && catalog.filter === 'archived'
  const courseFilterItems = teacherCourseFilters.map((item) => item.key === 'archived'
    ? { ...item, badge: catalog.coursesPage.summary.archivedCourses }
    : item)

  const handleRestoreCourse = useCallback((course: TeacherCatalogCourseItem) => {
    showModal({
      title: 'Restaurar curso',
      message: 'El curso volverá a aparecer entre tus cursos activos y estará disponible nuevamente según la configuración de sus clases.',
      variant: 'info',
      buttons: [
        { label: 'Cancelar', role: 'cancel' },
        {
          label: 'Restaurar',
          role: 'primary',
          onPress: async () => {
            setRestoringCourseId(course.id)
            try {
              await restoreTeacherSubject(course.id)
              catalog.coursesPage.markCourseRestored(course.id)
              await catalog.coursesPage.refresh()
              feedback.success('Curso restaurado', `${course.name} vuelve a estar disponible entre tus cursos activos.`)
            } catch (error) {
              feedback.error('No se pudo restaurar el curso', error instanceof Error ? error : 'Inténtalo de nuevo más tarde.')
            } finally {
              setRestoringCourseId(null)
            }
          },
        },
      ],
    })
  }, [catalog.coursesPage, feedback, showModal])

  if (catalog.activePayload.loading && catalog.items.length === 0) return <OmniLoadingScreen />

  return (
    <TeacherScreenLayout
      bottomPadding={0}
      contentContainerStyle={{ flex: 1 }}
      contentLabel="Cursos del profesor"
      desktopSidebar={isDesktop ? <TeacherSidebar activeSection="classes" subjectsCount={catalog.subjectsCount} onSignOut={() => { void signOutTeacherCatalog() }} /> : undefined}
      horizontalPadding={0}
      isDesktop={isDesktop}
      mobileBottomNavigation={!isDesktop ? <TeacherBottomNav active="classes" /> : undefined}
      scroll={false}
      topPadding={0}
    >
      <FlatList
        className="flex-1"
        data={catalog.items}
        keyExtractor={(item: TeacherCatalogItem) => `${item.kind}:${item.value.id}`}
        renderItem={({ item }: { item: TeacherCatalogItem }) => item.kind === 'course'
          ? <TeacherCourseCard course={item.value} analytics={item.value.analytics} density={isDesktop ? 'comfortable' : 'compact'} onRestore={() => handleRestoreCourse(item.value)} restoring={restoringCourseId === item.value.id} />
          : <TeacherClassroomCard classroom={item.value} analytics={item.value.analytics} course={item.value.course} density={isDesktop ? 'comfortable' : 'compact'} />}
        ItemSeparatorComponent={() => <View className={isDesktop ? "h-px bg-border-default" : "h-3"} />}
        ListHeaderComponent={(
          <>
            <TeacherPageHeader
              icon="book"
              isDesktop={isDesktop}
              title="Cursos y clases"
              mobileTitle="Cursos"
              notificationOnPress={() => router.push('/(teacher)/notifications' as never)}
              actions={isDesktop ? <AppButton label="Crear curso" accessibilityLabel="Crear curso" icon="add" role="teacher" onPress={() => router.push('/(teacher)/create-subject' as never)} /> : undefined}
            />
            {catalog.activePayload.error ? <View className="mb-4 rounded-xl border border-semantic-danger bg-semantic-surface-danger p-4"><Text className="font-bold text-semantic-danger">{catalog.activePayload.error}</Text></View> : null}
            <View className="mb-4">
              <AppTabs<TeacherCatalogTab>
                accessibilityLabel="Ver cursos o clases"
                fill
                items={[
                  { key: 'courses', label: `Cursos (${catalog.coursesPage.summary.courses})`, icon: 'book-outline' },
                  { key: 'classrooms', label: `Clases (${catalog.classroomsPage.summary.classrooms})`, icon: 'people-outline' },
                ]}
                onChange={catalog.setCatalogTab}
                role="teacher"
                value={catalog.catalogTab}
              />
            </View>
            <View className="mb-4 gap-3">
              <View className="min-h-12 flex-row items-center rounded-xl border border-border-default bg-surface-default px-4 py-2">
                <Ionicons name="search-outline" size={20} color="#AFC2DB" />
                <TextInput accessibilityLabel={catalog.catalogTab === 'courses' ? 'Buscar curso' : 'Buscar clase'} className="ml-3 min-w-0 flex-1 text-text-primary" placeholder={catalog.catalogTab === 'courses' ? 'Buscar curso...' : 'Buscar clase o curso...'} placeholderTextColor="#8FA7C7" value={catalog.searchInput} onChangeText={catalog.setSearchInput} />
              </View>
              {catalog.catalogTab === 'courses' ? (
                isDesktop ? (
                  <View className={responsive.isWide ? 'flex-row items-center gap-3' : 'gap-3'}>
                    <View className="min-w-0 flex-1">
                      <AppTabs<TeacherCourseFilter> accessibilityLabel="Filtrar cursos" compact mobileRail={!responsive.isWide} role="teacher" items={courseFilterItems} value={catalog.filter} onChange={catalog.setFilter} />
                    </View>
                    <View className="min-w-[340px] flex-[0.65]">
                      <AppTabs<TeacherCourseSort> accessibilityLabel="Ordenar cursos" compact fill role="teacher" items={teacherCourseSorts.map((item) => ({ ...item, icon: 'swap-vertical-outline' as const }))} value={catalog.sort} onChange={catalog.setSort} />
                    </View>
                  </View>
                ) : (
                  <View className="gap-2">
                    <AppTabs<TeacherCourseFilter> accessibilityLabel="Filtrar cursos" compact mobileRail role="teacher" items={courseFilterItems} value={catalog.filter} onChange={catalog.setFilter} />
                    <AppDropdown<TeacherCourseSort>
                      accessibilityLabel="Ordenar cursos"
                      compact
                      role="teacher"
                      value={catalog.sort}
                      options={teacherCourseSorts.map((item) => ({ value: item.key, label: `Orden: ${item.label}`, icon: 'swap-vertical-outline' as const }))}
                      onChange={catalog.setSort}
                    />
                  </View>
                )
              ) : null}
            </View>
            {isDesktop && catalog.items.length > 0 ? <CatalogTableHeader archived={viewingArchived} tab={catalog.catalogTab} /> : null}
          </>
        )}
        ListEmptyComponent={<CatalogEmptyState archived={viewingArchived} searching={Boolean(catalog.searchInput.trim())} />}
        ListFooterComponent={(
          <View>
            <PaginationControls compact={!isDesktop} onNext={() => catalog.setPage((current) => Math.min(catalog.maxPage, current + 1))} onPrevious={() => catalog.setPage((current) => Math.max(0, current - 1))} page={catalog.safePage} pageSize={pageSize} total={catalog.total} />
            {!isDesktop && !viewingArchived ? <CreateCourseCTA onPress={() => router.push('/(teacher)/create-subject' as never)} /> : null}
          </View>
        )}
        refreshControl={<RefreshControl refreshing={catalog.activePayload.refreshing} onRefresh={catalog.activePayload.refresh} tintColor="#8B5CF6" />}
        contentContainerStyle={{ paddingHorizontal: isDesktop ? 28 : 18, paddingTop: isDesktop ? 24 : 18, paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
    </TeacherScreenLayout>
  )
}

function CatalogTableHeader({ archived, tab }: { archived: boolean; tab: TeacherCatalogTab }) {
  if (tab === 'courses' && archived) {
    return (
      <View className="flex-row items-center gap-4 rounded-t-2xl border border-border-default bg-surface-raised px-4 py-3">
        <Text className="w-10 text-[11px] font-black uppercase text-text-muted">Curso</Text><Text className="flex-[1.5] text-[11px] font-black uppercase text-text-muted">Nombre</Text><Text className="w-28 text-center text-[11px] font-black uppercase text-text-muted">Archivado</Text><Text className="flex-1 text-[11px] font-black uppercase text-text-muted">Archivo / conservación</Text><Text className="w-28 text-center text-[11px] font-black uppercase text-text-muted">Acción</Text>
      </View>
    )
  }
  return tab === 'courses' ? (
    <View className="flex-row items-center gap-4 rounded-t-2xl border border-border-default bg-surface-raised px-4 py-3">
      <Text className="w-10 text-[11px] font-black uppercase text-text-muted">Curso</Text><Text className="flex-[1.5] text-[11px] font-black uppercase text-text-muted">Nombre</Text><Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Alumnos</Text><Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Preguntas</Text><Text className="w-28 text-center text-[11px] font-black uppercase text-text-muted">Participación</Text><View className="w-[18px]" />
    </View>
  ) : (
    <View className="flex-row items-center gap-4 rounded-t-2xl border border-border-default bg-surface-raised px-4 py-3">
      <Text className="w-10 text-[11px] font-black uppercase text-text-muted">Clase</Text><Text className="flex-[1.4] text-[11px] font-black uppercase text-text-muted">Nombre / curso</Text><Text className="min-w-24 flex-1 text-[11px] font-black uppercase text-text-muted">Año</Text><Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Alumnos</Text><Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Preguntas</Text><Text className="w-20 text-center text-[11px] font-black uppercase text-text-muted">Temas</Text><View className="w-[18px]" />
    </View>
  )
}

function CatalogEmptyState({ archived, searching }: { archived: boolean; searching: boolean }) {
  const title = archived
    ? searching ? 'No se encontraron cursos archivados' : 'No tienes cursos archivados'
    : 'No hay resultados'
  const detail = archived
    ? searching
      ? 'Prueba con otra búsqueda dentro de tus cursos archivados.'
      : 'Los cursos que archives aparecerán aquí y podrás restaurarlos cuando lo necesites.'
    : 'Prueba con otros filtros o crea un curso nuevo.'
  return (
    <View className="items-center rounded-2xl border border-dashed border-border-default bg-surface-default px-5 py-10">
      <Text className="text-center font-black text-text-primary">{title}</Text>
      <Text className="mt-2 text-center text-[13px] leading-5 text-text-muted">{detail}</Text>
    </View>
  )
}
