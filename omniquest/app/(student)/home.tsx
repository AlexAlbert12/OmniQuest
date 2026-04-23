import { useEffect, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'

export default function StudentHome() {
  const [email, setEmail] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email)
    })
  }, [])

  async function handleSignOut() {
    setLoading(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        Alert.alert('Error', error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-[#0F2854] px-6">
      <Text style={{ fontFamily: 'Pacifico_400Regular' }} className="text-4xl text-[#BDE8F5] mb-3">
        Inicio del Alumno
      </Text>
      <Text className="text-[#EAF6FB] text-base mb-8 text-center max-w-md">
        {email ? `Sesión iniciada como ${email}` : 'Sesión iniciada correctamente.'}
      </Text>

      <Pressable
        onPress={handleSignOut}
        disabled={loading}
        className={`w-full max-w-sm rounded-3xl border border-[#4988C4] bg-[#13315F] py-4 items-center ${loading ? 'opacity-70' : 'active:bg-[#1C4D8D]'}`}
      >
        <Text className="text-[#F5FBFE] font-semibold text-lg">
          {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </Text>
      </Pressable>
    </View>
  )
}
