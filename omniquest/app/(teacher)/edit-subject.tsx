import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import TeacherSubjectForm from '../../components/teacher/TeacherSubjectForm';

export default function EditSubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <TeacherSubjectForm mode="edit" subjectId={id} />;
}
