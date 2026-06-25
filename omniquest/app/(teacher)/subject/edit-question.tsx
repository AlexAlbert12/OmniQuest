import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TeacherQuestionForm from '../../../components/TeacherQuestionForm';

export default function EditQuestionScreen() {
  const { subjectId, questionId, topicId, classroomId, difficulty } = useLocalSearchParams<{
    subjectId: string;
    questionId: string;
    topicId?: string;
    classroomId?: string;
    difficulty?: string;
  }>();

  return (
    <TeacherQuestionForm
      mode="edit"
      subjectId={subjectId}
      questionId={questionId}
      initialTopicId={topicId || null}
      initialClassroomId={classroomId || null}
      initialDifficulty={difficulty || null}
    />
  );
}
