import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import TeacherPageHeader from './TeacherPageHeader'
import { useAppTheme } from '../../lib/appTheme'
import { useResponsiveLayout } from '../../lib/responsive'
import AppButton from '../ui/AppButton'
import AppDropdown from '../ui/AppDropdown'
import AppStatusBanner from '../ui/AppStatusBanner'
import OmniLoadingScreen from '../ui/OmniLoadingScreen'
import {
  FillBlankEditor,
  MatchingPairsEditor,
  MultipleChoiceEditor,
  OpenAnswerEditor,
  OrderingEditor,
  QuestionPreview,
  QuestionPromptEditor,
  QuestionSettingsPanel,
  QuestionTypeSelector,
  QuestionValidationPanel,
  QuestionWizardNavigation,
  TrueFalseEditor,
  useTeacherQuestionForm,
  type TeacherQuestionFormOptions,
} from './question-form'

export default function TeacherQuestionForm(props: TeacherQuestionFormOptions) {
  const responsive = useResponsiveLayout()
  const { width } = responsive
  const insets = useSafeAreaInsets()
  const { tokens } = useAppTheme()
  const form = useTeacherQuestionForm(props)
  const isDesktop = responsive.isDesktop
  const typeColumns = width >= 1320 ? 3 : width >= 720 ? 2 : 1

  if (form.initializing) return <OmniLoadingScreen />

  const step2Issues = form.visibleValidationIssues.filter((issue) => issue.step === 2)
  const questionTextError = step2Issues.find((issue) => issue.field === 'Enunciado')?.message
  const mediaError = step2Issues.find((issue) => issue.field === 'Contenido multimedia')?.message
  const answerError = form.visibleValidationIssues.find((issue) => issue.step === 3)?.message
  const classroomOptions = form.classrooms.map((classroom) => ({
    value: classroom.id,
    label: classroom.code ? `${classroom.name} · ${classroom.code}` : classroom.name,
    description: classroom.academicYear || undefined,
    icon: 'people-outline' as const,
  }))

  const renderAnswersStep = () => {
    switch (form.selectedType) {
      case 'boolean':
        return <TrueFalseEditor answers={form.visibleAnswers} error={answerError} onMarkCorrect={form.markAsCorrect} />
      case 'open':
        return <OpenAnswerEditor value={form.openExpectedAnswer} error={answerError} onChange={form.setOpenExpectedAnswer} />
      case 'fill':
        return <FillBlankEditor questionText={form.questionText} value={form.fillAnswersText} error={answerError} onChange={form.setFillAnswersText} />
      case 'order':
        return <OrderingEditor value={form.orderItemsText} error={answerError} onChange={form.setOrderItemsText} />
      case 'match':
        return <MatchingPairsEditor mode="match" value={form.matchPairsText} error={answerError} onChange={form.setMatchPairsText} />
      case 'dragdrop':
        return <MatchingPairsEditor mode="dragdrop" value={form.dragdropPairsText} error={answerError} onChange={form.setDragdropPairsText} />
      default:
        return (
          <MultipleChoiceEditor
            answers={form.visibleAnswers}
            optionsCount={form.optionsCount}
            error={answerError}
            onOptionsCountChange={form.handleOptionsCountChange}
            onChangeAnswer={form.updateAnswerText}
            onMarkCorrect={form.markAsCorrect}
          />
        )
    }
  }

  const uploadProgress = form.uploadingMedia ? (
    <View className="min-w-[240px] max-w-[420px] rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-black" style={{ color: tokens.text.primary }}>{getUploadStageLabel(form.mediaUploadStage)} · {Math.round(form.mediaUploadProgress)}%</Text>
        <AppButton label="Cancelar subida" size="sm" variant="danger" onPress={form.cancelMediaUpload} />
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tokens.surface.raised }}>
        <View style={{ width: `${Math.max(0, Math.min(100, form.mediaUploadProgress))}%`, height: '100%', backgroundColor: tokens.brand.teacher }} />
      </View>
    </View>
  ) : null

  const primaryAction = form.activeStep < 5 ? (
    <AppButton label="Siguiente" icon="arrow-forward" iconPosition="right" role="teacher" fullWidth={!isDesktop} onPress={form.handleNextStep} />
  ) : (
    <AppButton label={form.isEdit ? 'Actualizar pregunta' : 'Crear pregunta'} icon="checkmark" role="teacher" loading={form.saving} fullWidth={!isDesktop} onPress={form.handleSave} />
  )

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: isDesktop ? 30 : 126 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className={isDesktop ? 'px-6 pb-7 pt-5 lg:px-8' : 'px-4 pb-5 pt-4'}>
          <View
            className={isDesktop ? 'w-full rounded-[22px] border px-6 py-5' : 'w-full'}
            style={isDesktop ? { borderColor: tokens.border.default, backgroundColor: tokens.background.secondary } : undefined}
          >
            <TeacherPageHeader
              backAction={{ label: 'Cerrar', onPress: form.requestClose }}
              icon={form.isEdit ? 'create-outline' : 'help-circle-outline'}
              isDesktop={isDesktop}
              title={form.isEdit ? 'Editar pregunta' : 'Nueva pregunta'}
              subtitle={form.contextLabel || 'Selecciona el contexto de la pregunta.'}
              showNotifications={false}
              showAvatar={false}
              showGlobalSearch={false}
              className="mb-0"
            />

            <Text className="mt-3 text-[13px] leading-5" style={{ color: tokens.text.secondary }}>
              Crea una pregunta paso a paso y comprueba el resultado antes de publicarla.
            </Text>

            <View className="mt-4 max-w-[560px]">
              <AppDropdown
                label="Clase"
                value={form.selectedClassroomId}
                options={classroomOptions}
                disabled={form.saving || form.changingClassroom}
                onChange={(value) => { void form.handleClassroomChange(value) }}
                accessibilityLabel="Clase donde se publicará la pregunta"
              />
            </View>

            {form.sourceQuestionPrefilled ? (
              <View className="mt-4">
                <AppStatusBanner variant="info" compact title="Contenido precargado" message="Se ha preparado una nueva pregunta a partir de la pregunta original. Revísala antes de publicarla." />
              </View>
            ) : null}
            {form.sourceMediaUnavailable ? (
              <View className="mt-4">
                <AppStatusBanner variant="warning" compact title="Multimedia pendiente" message="No se pudo copiar automáticamente el recurso de la pregunta original. Vuelve a adjuntarlo si quieres conservarlo." />
              </View>
            ) : null}
            {form.draftRestored ? (
              <View className="mt-4">
                <AppStatusBanner variant="info" compact title="Borrador recuperado" message="Se restauraron los cambios guardados en este dispositivo tras el último cierre." />
              </View>
            ) : null}
            {form.draftMediaNeedsReattach ? (
              <View className="mt-4">
                <AppStatusBanner variant="warning" compact title="Vuelve a adjuntar el archivo" message="El recurso multimedia local ya no está disponible. El resto del borrador se ha recuperado." />
              </View>
            ) : null}

            <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2">
              <Text className="text-[12px] font-semibold" style={{ color: form.draftStatus === 'error' ? tokens.semantic.danger : tokens.text.muted }}>
                {getDraftStatusLabel(form.draftStatus, form.draftSavedAt, form.hasUnsavedChanges)}
              </Text>
              {form.hasUnsavedChanges || form.draftStatus === 'saved' ? (
                <View className="rounded-full border px-2.5 py-1" style={{ borderColor: tokens.semantic.warning, backgroundColor: tokens.surface.interactive }}>
                  <Text className="text-[10px] font-black tracking-[0.5px]" style={{ color: tokens.semantic.warning }}>{form.isEdit ? 'CAMBIOS NO PUBLICADOS' : 'NO PUBLICADO'}</Text>
                </View>
              ) : null}
            </View>

            <View className="mt-4">
              <QuestionWizardNavigation activeStep={form.activeStep} isDesktop={isDesktop} onSelect={form.goToStep} />
            </View>

            <View className="mt-5">
              {form.activeStep === 1 ? <QuestionTypeSelector selectedType={form.selectedType} columns={typeColumns} isDesktop={isDesktop} onSelect={form.handleTypeSelection} /> : null}

              {form.activeStep === 2 ? (
                <QuestionPromptEditor
                  selectedType={form.selectedType}
                  questionText={form.questionText}
                  fillAnswersText={form.fillAnswersText}
                  media={form.media}
                  disabled={form.saving}
                  questionTextError={questionTextError}
                  mediaError={mediaError}
                  onChangeQuestionText={form.setQuestionText}
                  onChangeFillAnswersText={form.setFillAnswersText}
                  onChangeMedia={form.setMedia}
                  onMediaError={(message) => showAlert('Contenido multimedia', message)}
                />
              ) : null}

              {form.activeStep === 3 ? renderAnswersStep() : null}

              {form.activeStep === 4 ? (
                <QuestionSettingsPanel
                  topics={form.topics}
                  selectedTopicId={form.selectedTopicId}
                  selectedDifficulty={form.selectedDifficulty}
                  timeLimit={form.timeLimit}
                  points={form.points}
                  explanation={form.explanation}
                  hint={form.hint}
                  timeLimitError={form.timeLimitError}
                  pointsError={form.pointsError}
                  isDesktop={isDesktop}
                  onSelectTopic={form.setSelectedTopicId}
                  onSelectDifficulty={form.setSelectedDifficulty}
                  onChangeTimeLimit={form.setTimeLimit}
                  onChangePoints={form.setPoints}
                  onChangeExplanation={form.setExplanation}
                  onChangeHint={form.setHint}
                />
              ) : null}

              {form.activeStep === 5 ? (
                <View className={isDesktop ? 'flex-row items-start gap-5' : 'gap-5'}>
                  <View className="min-w-0 flex-[1.55]">
                    <QuestionPreview
                      selectedType={form.selectedType}
                      selectedTypeCard={form.selectedTypeCard}
                      questionText={form.questionText}
                      media={form.media}
                      visibleAnswers={form.visibleAnswers}
                      openExpectedAnswer={form.openExpectedAnswer}
                      fillAnswersText={form.fillAnswersText}
                      orderItemsText={form.orderItemsText}
                      matchPairsText={form.matchPairsText}
                      dragdropPairsText={form.dragdropPairsText}
                      explanation={form.explanation}
                      hint={form.hint}
                      timeLimit={form.parsedTimeLimit}
                      points={form.parsedPoints}
                    />
                  </View>
                  <View className="min-w-0 flex-1"><QuestionValidationPanel issues={form.validationIssues} onOpenStep={form.goToStep} /></View>
                </View>
              ) : null}
            </View>

            {isDesktop ? (
              <View className="mt-5 flex-row items-center justify-between rounded-2xl border p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
                <AppButton label="Cancelar" variant="ghost" onPress={form.requestClose} />
                <View className="items-end gap-2">
                  {uploadProgress}
                  <View className="flex-row items-center gap-3">
                    {form.activeStep > 1 ? <AppButton label="Atrás" icon="arrow-back" variant="secondary" onPress={form.handlePreviousStep} /> : null}
                    {primaryAction}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {!isDesktop ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t px-4 pt-3"
          style={{ borderColor: tokens.border.default, backgroundColor: tokens.background.secondary, paddingBottom: Math.max(12, insets.bottom) }}
        >
          {uploadProgress ? <View className="mb-2">{uploadProgress}</View> : null}
          <View className="flex-row items-center gap-3">
            {form.activeStep > 1 ? <View className="flex-1"><AppButton label="Atrás" icon="arrow-back" variant="secondary" fullWidth onPress={form.handlePreviousStep} /></View> : <View className="flex-1" />}
            <View className="flex-1">{primaryAction}</View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

function showAlert(title: string, message: string) {
  Alert.alert(title, message)
}

function getDraftStatusLabel(status: string, savedAt: string | null, dirty: boolean) {
  if (status === 'saving') return 'Guardando localmente…'
  if (status === 'pending') return 'Cambios pendientes de guardado local…'
  if (status === 'error') return 'No se pudo actualizar el borrador local.'
  if (status === 'saved' && savedAt) {
    const date = new Date(savedAt)
    const time = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return `Guardado localmente${time ? ` a las ${time}` : ''}`
  }
  return dirty ? 'Pendiente de guardado local' : 'Sin cambios pendientes'
}

function getUploadStageLabel(stage: string | null) {
  if (stage === 'validating') return 'Validando archivo'
  if (stage === 'reading') return 'Leyendo archivo'
  if (stage === 'scanning') return 'Escaneando contenido'
  if (stage === 'uploading') return 'Subiendo multimedia'
  if (stage === 'processing') return 'Procesando multimedia'
  if (stage === 'signing') return 'Preparando vista previa'
  if (stage === 'complete') return 'Subida completada'
  return 'Preparando subida'
}
