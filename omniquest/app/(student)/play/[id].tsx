import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGame } from '../../../hooks/useGame';

export default function PlayScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const game = useGame(id as string);

  if (game.status === 'loading') {
    return <View className="flex-1 bg-slate-900 justify-center"><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  if (game.status === 'empty') {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center px-6">
        <Ionicons name="construct-outline" size={64} color="#64748b" mb={4} />
        <Text className="text-white text-xl font-bold mb-2 text-center">¡Ups! El profesor aún no ha añadido retos.</Text>
        <Pressable onPress={() => router.back()} className="mt-6 bg-indigo-500 px-6 py-3 rounded-xl active:bg-indigo-600">
          <Text className="text-white font-bold">Volver al inicio</Text>
        </Pressable>
      </View>
    );
  }

  if (game.status === 'gameOver') {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center px-6">
        <Ionicons name="skull-outline" size={80} color="#fb7185" mb={4} />
        <Text className="text-rose-400 text-3xl font-bold mb-2">¡GAME OVER!</Text>
        <Text className="text-slate-300 text-lg mb-8 text-center">Te has quedado sin vidas. ¡Vuelve a intentarlo!</Text>
        <Text className="text-white text-2xl font-bold mb-8">Puntos conseguidos: {game.score}</Text>
        <Pressable onPress={() => router.back()} className="bg-slate-800 border border-slate-700 px-8 py-4 rounded-2xl active:bg-slate-700">
          <Text className="text-white font-bold text-lg">Salir al menú</Text>
        </Pressable>
      </View>
    );
  }

  if (game.status === 'finished') {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center px-6">
        <Ionicons name="trophy" size={80} color="#fbbf24" mb={4} />
        <Text className="text-amber-400 text-3xl font-bold mb-2 text-center">¡RETOS COMPLETADOS!</Text>
        <Text className="text-slate-300 text-lg mb-8 text-center">Has superado todas las preguntas de esta clase.</Text>
        
        <View className="bg-slate-800 p-6 rounded-2xl border border-slate-700 items-center w-full max-w-xs mb-8">
          <Text className="text-slate-400 font-medium mb-1">Puntuación Final</Text>
          <Text className="text-indigo-400 text-5xl font-black">{game.score}</Text>
        </View>

        <Pressable onPress={() => router.back()} className="bg-indigo-500 px-8 py-4 rounded-2xl w-full max-w-xs items-center active:bg-indigo-600">
          <Text className="text-white font-bold text-lg">Volver al inicio</Text>
        </Pressable>
      </View>
    );
  }

  const progressPercentage = ((game.currentIndex) / game.questions.length) * 100;

  return (
    <View className="flex-1 bg-slate-900 pt-12 px-6">
      <View className="flex-row justify-between items-center mb-6">
        <Pressable onPress={() => router.back()} className="p-2 bg-slate-800 rounded-full">
          <Ionicons name="close" size={24} color="#cbd5e1" />
        </Pressable>
        
        <View className="flex-row space-x-1">
          {[...Array(3)].map((_, i) => (
            <Ionicons key={i} name={i < game.lives ? "heart" : "heart-outline"} size={28} color="#fb7185" />
          ))}
        </View>
      </View>

      <View className="mb-8">
        <View className="flex-row justify-between mb-2">
          <Text className="text-slate-400 font-bold">Reto {game.currentIndex + 1} de {game.questions.length}</Text>
          <View className="flex-row items-center">
            {game.streak > 1 && <Text className="text-orange-400 font-bold mr-3">🔥 x{game.streak}</Text>}
            <Text className="text-indigo-400 font-bold">{game.score} pts</Text>
          </View>
        </View>
        <View className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <View className="h-full bg-indigo-500 rounded-full" style={{ width: `${progressPercentage}%` }} />
        </View>
      </View>

      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className={`self-center px-4 py-2 rounded-full mb-6 flex-row items-center ${game.timeLeft <= 5 ? 'bg-rose-500/20' : 'bg-slate-800'}`}>
            <Ionicons name="timer-outline" size={20} color={game.timeLeft <= 5 ? '#fb7185' : '#94a3b8'} />
            <Text className={`font-mono font-bold text-xl ml-2 ${game.timeLeft <= 5 ? 'text-rose-400' : 'text-white'}`}>
              00:{game.timeLeft.toString().padStart(2, '0')}
            </Text>
          </View>

          <Text className="text-3xl font-bold text-white text-center mb-10 leading-tight">
            {game.currentQuestion?.text}
          </Text>

          <View className="space-y-4 pb-10">
            {game.currentQuestion?.answers.map((answer: any) => {
              const isSelected = game.selectedAnswerId === answer.id;
              let btnStyle = "bg-slate-800 border-slate-700";
              let textStyle = "text-white";
              
              if (game.selectedAnswerId !== null) {
                if (answer.is_correct) {
                  btnStyle = "bg-emerald-500/20 border-emerald-500"; 
                  textStyle = "text-emerald-400 font-bold";
                } else if (isSelected && !answer.is_correct) {
                  btnStyle = "bg-rose-500/20 border-rose-500"; 
                  textStyle = "text-rose-400 font-bold";
                } else {
                  btnStyle = "bg-slate-900 border-slate-800 opacity-50";
                  textStyle = "text-slate-500";
                }
              }

              return (
                <Pressable
                  key={answer.id}
                  onPress={() => game.submitAnswer(answer.id)}
                  className={`w-full p-5 rounded-2xl border-2 flex-row items-center justify-between ${btnStyle} ${game.selectedAnswerId === null ? 'active:bg-slate-700' : ''}`}
                >
                  <Text className={`text-lg flex-1 ${textStyle}`}>{answer.text}</Text>
                  
                  {game.selectedAnswerId !== null && answer.is_correct && (
                    <Ionicons name="checkmark-circle" size={24} color="#34d399" />
                  )}
                  {isSelected && !answer.is_correct && (
                    <Ionicons name="close-circle" size={24} color="#fb7185" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}