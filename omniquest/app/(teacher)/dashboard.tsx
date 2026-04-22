import { useEffect, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'

export default function TeacherDashboard() {
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
    <View className="flex-1 items-center justify-center bg-slate-900 px-6">
      <Text className="text-white text-3xl font-bold mb-3">Panel del Profesor</Text>
      <Text className="text-slate-300 text-base mb-8 text-center">
        {email ? `Sesion iniciada como ${email}` : 'Sesion iniciada correctamente.'}
      </Text>

      <Pressable
        onPress={handleSignOut}
        disabled={loading}
        className={`w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 py-4 items-center ${loading ? 'opacity-70' : 'active:bg-slate-700'}`}
      >
        <Text className="text-white font-semibold text-lg">
          {loading ? 'Cerrando sesion...' : 'Cerrar sesión'}
        </Text>
      </Pressable>
    </View>
  )
}
