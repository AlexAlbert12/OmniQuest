import React from 'react';
import { Image, Pressable, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type StudentProfile = {
  alias: string | null
  avatar: string | null
}

export default function StudentHeaderAvatar() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<StudentProfile>({ alias: null, avatar: null });

  useFocusEffect(
    React.useCallback(() => {
      let canceled = false;

      const loadProfile = async () => {
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user.id;

        if (!userId) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('alias, avatar')
          .eq('id', userId)
          .single();

        if (!canceled && !error && data) {
          setProfile({
            alias: data.alias ?? null,
            avatar: data.avatar ?? null,
          });
        }
      };

      loadProfile();

      return () => {
        canceled = true;
      };
    }, [])
  );

  const alias = profile.alias || 'Alumno';

  return (
    <Pressable
      accessibilityLabel="Abrir perfil del alumno"
      onPress={() => router.push('/(student)/profile' as any)}
      className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#5B4BC4]"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      {profile.avatar && profile.avatar.startsWith('http') ? (
        <Image source={{ uri: profile.avatar }} className="h-full w-full" />
      ) : (
        <Text className="font-black text-white">{getInitials(alias)}</Text>
      )}
    </Pressable>
  );
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase()).join('');
  return initials || 'A';
}
