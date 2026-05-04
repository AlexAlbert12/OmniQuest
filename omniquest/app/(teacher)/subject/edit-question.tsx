import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TeacherQuestionForm from '../../../components/TeacherQuestionForm';

export default function EditQuestionScreen() {
  const { subjectId, questionId, topicId } = useLocalSearchParams<{
    subjectId: string;
    questionId: string;
    topicId?: string;
  }>();

  return (
    <TeacherQuestionForm
      mode="edit"
      subjectId={subjectId}
      questionId={questionId}
      initialTopicId={topicId || null}
    />
  );
}
