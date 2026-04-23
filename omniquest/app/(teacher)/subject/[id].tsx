import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Link, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function SubjectDetailScreen() {
    const { id } = useLocalSearchParams();
    const [subject, setSubject] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchData = async () => {
        try {
            const { data: subjectData } = await supabase
                .from('subjects')
                .select('*')
                .eq('id', id)
                .single();
            setSubject(subjectData);

            const { data: questionsData } = await supabase
                .from('questions')
                .select('*, answers(*)')
                .eq('subject_id', id)
                .order('created_at', { ascending: false });

            setQuestions(questionsData || []);
        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [id])
    );

    const executeDelete = async (questionId: number) => {
        try {
            const { error } = await supabase
                .from('questions')
                .delete()
                .eq('id', questionId);

            if (error) throw error;

            setQuestions(prevQuestions => prevQuestions.filter(q => q.id !== questionId));
        } catch (error: any) {
            if (Platform.OS === 'web') {
                window.alert("Error al borrar: " + error.message);
            } else {
                Alert.alert("Error al borrar", error.message);
            }
        }
    };

    const handleDelete = (questionId: number) => {
        if (Platform.OS === 'web') {
            const confirmDelete = window.confirm("¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.");
            if (confirmDelete) {
                executeDelete(questionId);
            }
        } else {
            Alert.alert(
                "Borrar Reto",
                "¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer.",
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Sí, borrar",
                        style: "destructive",
                        onPress: () => executeDelete(questionId)
                    }
                ]
            );
        }
    };

    const renderQuestion = ({ item, index }: { item: any, index: number }) => (
        <View className="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700">
            <View className="flex-row justify-between items-start mb-2">
                <Text className="text-white font-bold flex-1 mr-2">
                    {questions.length - index}. {item.text}
                </Text>

                <View className="flex-row space-x-2">
                    <Link href={`/(teacher)/subject/edit-question?questionId=${item.id}&subjectId=${id}`} asChild>
                        <Pressable className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30 active:bg-indigo-500/40">
                            <Ionicons name="create-outline" size={18} color="#818cf8" />
                        </Pressable>
                    </Link>

                    <Pressable
                        onPress={() => handleDelete(item.id)}
                        className="bg-rose-500/20 p-2 rounded-lg border border-rose-500/30 active:bg-rose-500/40 ml-2"
                    >
                        <Ionicons name="trash-outline" size={18} color="#fb7185" />
                    </Pressable>
                </View>
            </View>

            <View className="flex-row items-center justify-between mt-2">
                <Text className="text-emerald-400 text-sm">
                    ✓ {item.answers?.find((a: any) => a.is_correct)?.text || 'Sin respuesta'}
                </Text>
                <View className="bg-slate-700 px-2 py-1 rounded">
                    <Text className="text-slate-300 text-[10px] uppercase font-bold">{item.points_base} pts</Text>
                </View>
            </View>
        </View>
    );

    if (loading) return <ActivityIndicator size="large" color="#6366f1" className="mt-20" />;

    return (
        <View className="flex-1 bg-slate-900 px-6 pt-12">
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full">
                    <Ionicons name="arrow-back" size={24} color="#cbd5e1" />
                </Pressable>
                <View className="flex-1">
                    <Text className="text-2xl font-bold text-white">{subject?.icon} {subject?.name}</Text>
                    <Text className="text-indigo-400 font-mono">Código: {subject?.code}</Text>
                </View>
            </View>

            <Text className="text-slate-400 mb-4 font-semibold">PREGUNTAS DE LA ASIGNATURA</Text>

            <FlatList
                data={questions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderQuestion}
                ListEmptyComponent={
                    <View className="items-center justify-center mt-10 p-6 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed">
                        <Ionicons name="help-outline" size={48} color="#64748b" mb-2 />
                        <Text className="text-slate-400 text-center">No hay preguntas todavía.</Text>
                        <Text className="text-slate-500 text-center text-sm">Añade tu primer reto para los alumnos.</Text>
                    </View>
                }
            />

            <Link href={`/(teacher)/subject/add-question?subjectId=${id}`} asChild>
                <Pressable className="absolute bottom-8 right-6 bg-indigo-500 w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50 active:bg-indigo-600">
                    <Ionicons name="add" size={32} color="white" />
                </Pressable>
            </Link>
        </View>
    );
}