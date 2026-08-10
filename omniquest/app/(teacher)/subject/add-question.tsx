import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import TeacherQuestionForm from '../../../components/teacher/TeacherQuestionForm'

export default function AddQuestionScreen() {
  const { subjectId, topicId, classroomId, difficulty, sourceQuestionId } = useLocalSearchParams<{ subjectId: string; topicId?: string; classroomId?: string; difficulty?: string; sourceQuestionId?: string }>()
  return <TeacherQuestionForm mode="create" subjectId={subjectId} sourceQuestionId={sourceQuestionId || null} initialTopicId={topicId || null} initialClassroomId={classroomId || null} initialDifficulty={difficulty || null} />
}
