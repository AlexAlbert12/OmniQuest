import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TeacherQuestionForm from '../../../components/TeacherQuestionForm';

export default function AddQuestionScreen() {
  const { subjectId, topicId, classroomId } = useLocalSearchParams<{ subjectId: string; topicId?: string; classroomId?: string }>();

  return (
    <TeacherQuestionForm
      mode="create"
      subjectId={subjectId}
      initialTopicId={topicId || null}
      initialClassroomId={classroomId || null}
    />
  );
}
