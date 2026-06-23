import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TeacherQuestionForm from '../../../components/TeacherQuestionForm';

export default function EditQuestionScreen() {
  const { subjectId, questionId, topicId, classroomId } = useLocalSearchParams<{
    subjectId: string;
    questionId: string;
    topicId?: string;
    classroomId?: string;
  }>();

  return (
    <TeacherQuestionForm
      mode="edit"
      subjectId={subjectId}
      questionId={questionId}
      initialTopicId={topicId || null}
      initialClassroomId={classroomId || null}
    />
  );
}
