import React from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import TeacherPageHeader from './TeacherPageHeader'
import TeacherBottomNav from './TeacherBottomNav'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { useAppTheme } from '../../lib/appTheme'
import AppButton from '../ui/AppButton'
import AppStatusBanner from '../ui/AppStatusBanner'
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
  const { width } = useWindowDimensions()
  const { tokens } = useAppTheme()
  const form = useTeacherQuestionForm(props)
  const isDesktop = width >= 1080
  const typeColumns = width >= 1320 ? 3 : width >= 720 ? 2 : 1

  if (form.initializing) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background.primary }}>
        <ActivityIndicator size="large" color={tokens.brand.teacher} />
        <Text className="mt-4" style={{ color: tokens.text.muted }}>Cargando pregunta...</Text>
      </View>
    )
  }

  const renderAnswersStep = () => {
    switch (form.selectedType) {
      case 'boolean':
        return <TrueFalseEditor answers={form.visibleAnswers} onMarkCorrect={form.markAsCorrect} />
      case 'open':
        return <OpenAnswerEditor value={form.openExpectedAnswer} onChange={form.setOpenExpectedAnswer} />
      case 'fill':
        return <FillBlankEditor value={form.fillAnswersText} onChange={form.setFillAnswersText} />
      case 'order':
        return <OrderingEditor value={form.orderItemsText} onChange={form.setOrderItemsText} />
      case 'match':
        return <MatchingPairsEditor mode="match" value={form.matchPairsText} onChange={form.setMatchPairsText} />
      case 'dragdrop':
        return <MatchingPairsEditor mode="dragdrop" value={form.dragdropPairsText} onChange={form.setDragdropPairsText} />
      default:
        return (
          <MultipleChoiceEditor
            answers={form.visibleAnswers}
            optionsCount={form.optionsCount}
            onOptionsCountChange={form.handleOptionsCountChange}
            onChangeAnswer={form.updateAnswerText}
            onMarkCorrect={form.markAsCorrect}
          />
        )
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: tokens.background.primary }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: isDesktop ? 30 : MOBILE_BOTTOM_NAV_SPACER }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pb-7 pt-5 md:px-6 lg:px-8">
          <View
            className="mx-auto w-full max-w-[1440px] rounded-[22px] border px-4 py-5 md:px-6"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.background.secondary }}
          >
            <TeacherPageHeader
              backAction={{ label: 'Cerrar', onPress: form.requestClose }}
              icon={form.isEdit ? 'create-outline' : 'help-circle-outline'}
              isDesktop={isDesktop}
              title={form.isEdit ? 'Editar pregunta' : 'Nueva pregunta'}
              subtitle="Crea una pregunta paso a paso y comprueba el resultado antes de publicarla."
              showNotifications={false}
              showAvatar={false}
              className="mb-0"
            />

            {form.draftRestored ? (
              <View className="mt-5">
                <AppStatusBanner
                  variant="info"
                  compact
                  title="Borrador recuperado"
                  message="Se restauraron los cambios guardados en este dispositivo tras el último cierre."
                />
              </View>
            ) : null}

            <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2">
              <Text className="text-[12px] font-semibold" style={{ color: form.draftStatus === 'error' ? tokens.semantic.danger : tokens.text.muted }}>
                {getDraftStatusLabel(form.draftStatus, form.draftSavedAt, form.hasUnsavedChanges)}
              </Text>
              {form.hasUnsavedChanges ? <Text className="text-[11px] font-black" style={{ color: tokens.semantic.warning }}>BORRADOR LOCAL</Text> : null}
            </View>

            <View className="mt-4">
              <QuestionWizardNavigation activeStep={form.activeStep} isDesktop={isDesktop} onSelect={form.goToStep} />
            </View>

            <View className="mt-5">
              {form.activeStep === 1 ? (
                <QuestionTypeSelector selectedType={form.selectedType} columns={typeColumns} onSelect={form.handleTypeSelection} />
              ) : null}

              {form.activeStep === 2 ? (
                <QuestionPromptEditor
                  selectedType={form.selectedType}
                  questionText={form.questionText}
                  media={form.media}
                  disabled={form.saving}
                  onChangeQuestionText={form.setQuestionText}
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
                  timeLimitError={form.timeLimitError}
                  pointsError={form.pointsError}
                  isDesktop={isDesktop}
                  onSelectTopic={form.setSelectedTopicId}
                  onSelectDifficulty={form.setSelectedDifficulty}
                  onChangeTimeLimit={form.setTimeLimit}
                  onChangePoints={form.setPoints}
                  onChangeExplanation={form.setExplanation}
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
                      timeLimit={form.parsedTimeLimit}
                      points={form.parsedPoints}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <QuestionValidationPanel issues={form.validationIssues} onOpenStep={form.goToStep} />
                  </View>
                </View>
              ) : null}
            </View>

            <View
              className={`mt-5 rounded-2xl border p-4 ${isDesktop ? 'flex-row items-center justify-between' : 'gap-3'}`}
              style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}
            >
              <AppButton label="Cancelar" variant="ghost" onPress={form.requestClose} />
              <View className={isDesktop ? 'flex-row items-center gap-3' : 'gap-3'}>
                {form.activeStep > 1 ? (
                  <AppButton
                    label="Atrás"
                    icon="arrow-back"
                    variant="secondary"
                    fullWidth={!isDesktop}
                    onPress={form.handlePreviousStep}
                  />
                ) : null}
                {form.activeStep < 5 ? (
                  <AppButton
                    label="Siguiente"
                    icon="arrow-forward"
                    iconPosition="right"
                    role="teacher"
                    fullWidth={!isDesktop}
                    onPress={form.handleNextStep}
                  />
                ) : (
                  <View className={isDesktop ? 'items-end gap-2' : 'gap-2'}>
                    {form.uploadingMedia ? (
                      <View className="min-w-[260px] max-w-[420px] rounded-xl border p-3" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.interactive }}>
                        <View className="flex-row items-center justify-between gap-3">
                          <Text className="text-[12px] font-black" style={{ color: tokens.text.primary }}>
                            {getUploadStageLabel(form.mediaUploadStage)} · {Math.round(form.mediaUploadProgress)}%
                          </Text>
                          <AppButton label="Cancelar subida" size="sm" variant="danger" onPress={form.cancelMediaUpload} />
                        </View>
                        <View className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tokens.surface.raised }}>
                          <View style={{ width: `${Math.max(0, Math.min(100, form.mediaUploadProgress))}%`, height: '100%', backgroundColor: tokens.brand.teacher }} />
                        </View>
                      </View>
                    ) : null}
                    <AppButton
                    label={form.isEdit ? 'Actualizar pregunta' : 'Crear pregunta'}
                    icon="checkmark"
                    role="teacher"
                    loading={form.saving}
                    fullWidth={!isDesktop}
                    onPress={form.handleSave}
                  />
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      {!isDesktop ? <TeacherBottomNav active="classes" /> : null}
    </View>
  )
}

function showAlert(title: string, message: string) {
  Alert.alert(title, message)
}

function getDraftStatusLabel(status: string, savedAt: string | null, dirty: boolean) {
  if (status === 'saving') return 'Guardando borrador…'
  if (status === 'pending') return 'Cambios pendientes de autosave…'
  if (status === 'error') return 'No se pudo actualizar el borrador local.'
  if (status === 'saved' && savedAt) {
    const date = new Date(savedAt)
    const time = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return dirty ? `Borrador guardado${time ? ` a las ${time}` : ``}` : 'Sin cambios pendientes'
  }
  return dirty ? 'Borrador pendiente' : 'Sin cambios pendientes'
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
