import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function AddQuestionScreen() {
  const { subjectId } = useLocalSearchParams();
  const router = useRouter();
  
  const [questionText, setQuestionText] = useState('');
  const [timeLimit, setTimeLimit] = useState('30');
  const [points, setPoints] = useState('10');
  const [loading, setLoading] = useState(false);

  const [answers, setAnswers] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);

  const updateAnswerText = (text: string, index: number) => {
    const newAnswers = [...answers];
    newAnswers[index].text = text;
    setAnswers(newAnswers);
  };

  const markAsCorrect = (indexToMark: number) => {
    const newAnswers = answers.map((ans, i) => ({
      ...ans,
      isCorrect: i === indexToMark,
    }));
    setAnswers(newAnswers);
  };

  const handleSave = async () => {
    if (!questionText.trim()) return Alert.alert('Error', 'La pregunta no puede estar vacía');
    if (answers.some(a => !a.text.trim())) return Alert.alert('Error', 'Rellena las 4 opciones de respuesta');

    setLoading(true);
    try {
      const { data: newQuestion, error: qError } = await supabase
        .from('questions')
        .insert([{
          subject_id: subjectId,
          type: 'multiple_choice',
          text: questionText,
          points_base: parseInt(points) || 10,
          time_limit_seconds: parseInt(timeLimit) || 30,
        }])
        .select()
        .single();

      if (qError) throw qError;

      const answersToInsert = answers.map((ans, index) => ({
        question_id: newQuestion.id,
        text: ans.text,
        is_correct: ans.isCorrect,
        sort_order: index + 1,
      }));

      const { error: aError } = await supabase.from('answers').insert(answersToInsert);
      if (aError) throw aError;

      Alert.alert('¡Éxito!', 'Pregunta guardada correctamente');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-900 px-6 pt-12" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="flex-row items-center mb-6">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full">
          <Ionicons name="close" size={24} color="#cbd5e1" />
        </Pressable>
        <Text className="text-2xl font-bold text-white">Nuevo Reto</Text>
      </View>

      <View className="mb-6">
        <Text className="text-slate-300 font-medium mb-2 ml-1">Enunciado de la Pregunta</Text>
        <TextInput
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg"
          placeholder="Ej: ¿En qué año se descubrió América?"
          placeholderTextColor="#64748b"
          value={questionText}
          onChangeText={setQuestionText}
          multiline
        />
        
        <View className="flex-row space-x-4 mt-4 justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-slate-400 text-xs mb-1 ml-1">Tiempo (segundos)</Text>
            <TextInput
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-center font-bold"
              value={timeLimit}
              onChangeText={setTimeLimit}
              keyboardType="number-pad"
            />
          </View>
          <View className="flex-1 ml-2">
            <Text className="text-slate-400 text-xs mb-1 ml-1">Puntos Base</Text>
            <TextInput
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-center font-bold"
              value={points}
              onChangeText={setPoints}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>

      <Text className="text-slate-300 font-medium mb-3 ml-1">Opciones de Respuesta</Text>
      <Text className="text-slate-500 text-xs mb-4 ml-1">Rellena las opciones y marca el círculo de la correcta.</Text>

      {answers.map((answer, index) => (
        <View key={index} className={`flex-row items-center mb-3 rounded-xl border ${answer.isCorrect ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800'}`}>
          <Pressable 
            onPress={() => markAsCorrect(index)}
            className="p-4"
          >
            <Ionicons 
              name={answer.isCorrect ? "checkmark-circle" : "ellipse-outline"} 
              size={28} 
              color={answer.isCorrect ? "#10b981" : "#64748b"} 
            />
          </Pressable>
          <TextInput
            className={`flex-1 py-4 pr-4 text-white ${answer.isCorrect ? 'font-semibold' : ''}`}
            placeholder={`Opción ${index + 1}`}
            placeholderTextColor="#64748b"
            value={answer.text}
            onChangeText={(text) => updateAnswerText(text, index)}
          />
        </View>
      ))}

      <Pressable 
        onPress={handleSave}
        disabled={loading}
        className={`w-full bg-indigo-500 rounded-xl py-4 items-center mt-6 ${loading ? 'opacity-70' : 'active:bg-indigo-600'}`}
      >
        <Text className="text-white font-bold text-lg">
          {loading ? 'Guardando...' : 'Guardar Pregunta'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}