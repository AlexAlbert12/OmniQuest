import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TeacherTopicForm from '../../components/TeacherTopicForm';

export default function EditTopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <TeacherTopicForm topicId={id} />;
}
