import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Footer from '../components/Footer'

type Benefit = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
}

const benefits: Benefit[] = [
  {
    icon: 'book-outline',
    title: 'Aprende a tu ritmo',
    description: 'Contenido diseñado para ti',
  },
  {
    icon: 'rocket-outline',
    title: 'Alcanza tus metas',
    description: 'Supera tus límites cada día',
  },
  {
    icon: 'trophy-outline',
    title: 'Logra más',
    description: 'Tu éxito es nuestra misión',
  },
]

export default function IndexScreen() {
  const { width, height } = useWindowDimensions()
  const router = useRouter()

  const isDesktop = width >= 1100
  const isWeb = Platform.OS === 'web'

  const showComingSoon = (feature: string) => {
    const title = 'Próximamente'
    const message = `${feature} estará disponible en una próxima iteración.`

    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`)
      return
    }

    Alert.alert(title, message)
  }

  return (
    <ScrollView
      className="flex-1 bg-[#04112A]" contentContainerStyle={{ flexGrow: 1, }}
    >
      <View
        className="overflow-hidden rounded-[34px] border border-[#27436F] bg-[#071630]"
        style={{
          minHeight: isDesktop ? Math.max(height, 760) : Math.max(height - 28, 720),
          shadowColor: '#132C59',
          shadowOpacity: isWeb ? 0 : 0.35,
          shadowRadius: isWeb ? 0 : 28,
          shadowOffset: { width: 0, height: isWeb ? 0 : 18 },
          elevation: isWeb ? 0 : 12,
          borderRadius: isWeb ? 0 : 34,
        }}
      >
        <View
          style={{
            flexGrow: 1, // CORRECCIÓN
            paddingHorizontal: isDesktop ? 32 : 18,
            paddingTop: isDesktop ? 20 : 18,
            paddingBottom: isDesktop ? 40 : 28,
          }}
        >
          <Header
            isDesktop={isDesktop}
            onThemePress={() => showComingSoon('El selector de tema')}
          />

          <View
            style={{
              flexGrow: 1, // CORRECCIÓN
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: isDesktop ? 1040 : 920,
                alignSelf: 'center',
              }}
            >
              <DesktopPanel
                isDesktop={isDesktop}
                onLoginPress={() => router.push('/login')}
                onGuestPress={() => showComingSoon('El acceso como invitado')}
                onRegisterPress={() => router.push('/register')}
                onSocialPress={(label) => showComingSoon(`El acceso con ${label}`)}
              />
            </View>
          </View>
        </View>
      </View>
      <Footer />
    </ScrollView>
  )
}

function Header({
  isDesktop,
  onThemePress,
}: {
  isDesktop: boolean
  onThemePress: () => void
}) {
  return (
    <View
      className="z-10 mb-5 flex-row items-center justify-between"
      style={{ marginBottom: isDesktop ? 10 : 12 }}
    >
      <Text
        style={{ fontFamily: 'Pacifico_400Regular' }}
        className="text-[#D7F5FF]"
      >
        <Text style={{ fontSize: isDesktop ? 28 : 25 }}>OmniQuest</Text>
      </Text>

      <Pressable
        onPress={onThemePress}
        className="flex-row items-center gap-2 rounded-full border border-[#4988C4] bg-[#4988C4]/15 px-4 py-3"
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
          paddingHorizontal: isDesktop ? 18 : 16,
          paddingVertical: isDesktop ? 10 : 12,
        })}
      >
        <Ionicons name="moon-outline" size={18} color="#4988C4" />
        <Text className="text-[15px] font-semibold text-[#E7F7FF]">Tema</Text>
      </Pressable>
    </View>
  )
}

function DesktopPanel({
  isDesktop,
  onLoginPress,
  onGuestPress,
  onRegisterPress,
}: {
  isDesktop: boolean
  onLoginPress: () => void
  onGuestPress: () => void
  onRegisterPress: () => void
  onSocialPress: (label: string) => void
}) {
  const isWeb = Platform.OS === 'web'
  
  return (
    <View
      style={{
        alignSelf: 'center',
        paddingTop: isDesktop ? 20 : 8,
      }}
    >
      <View className="items-center px-4">
        <View className="flex-row items-center gap-3 mb-4">
          <Ionicons name="sparkles" size={20} color="#7DC7FF" />
          <Text
            style={{ fontFamily: 'Pacifico_400Regular' }}
            className={`text-white text-center ${isWeb ? 'text-6xl' : 'text-4xl'}`}
          >
            ¡Bienvenido a OmniQuest!
          </Text>
          <Ionicons name="sparkles" size={20} color="#7DC7FF" />
        </View>

        <Text
          className={`mt-4 text-center text-[#3DAAFF] ${isWeb ? 'text-2xl' : 'text-xl'}`}
          style={{ fontFamily: 'Pacifico_400Regular' }}
        >
          Tu viaje de aprendizaje comienza aquí.
        </Text>
      </View>

      <View
        style={{
          marginTop: isDesktop ? 42 : 28,
          flexDirection: isDesktop ? 'row' : 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <View
          className="rounded-[30px] border border-[#34557E] bg-[#102548]/88"
          style={{
            width: 290,
            minHeight: 300,
            paddingHorizontal: 18,
            paddingVertical: 20,
            shadowColor: '#0C1F45',
            shadowOpacity: 0.26,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <View className="items-center gap-2">
            <View
              className="items-center justify-center rounded-full border"
              style={{
                width: 62,
                height: 62,
                backgroundColor: 'rgba(57, 135, 255, 0.18)',
                borderColor: 'rgba(88, 175, 255, 0.55)',
              }}
            >
              <Ionicons name="person" size={28} color="#58AFFF" />
            </View>

            <Text className="text-center text-[17px] font-bold text-white">
              Iniciar Sesión
            </Text>
            <Text className="text-center text-[14px] leading-7 text-[#D8E7F6]">
              Accede a tu cuenta para continuar tu viaje de aprendizaje.
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={onLoginPress}
            className="mt-4 w-full rounded-2xl py-4 flex-row items-center justify-center gap-2 bg-[#1C4D8D] active:bg-[#4988C4]"
          >
            <Text className="text-white font-bold text-sm">Inicia Sesión</Text>
          </Pressable>

          <View
            style={{ marginTop: 22, minHeight: 28 }}
            className="flex-row items-center justify-center gap-1"
          >
            <Text className="text-center text-[15px] text-[#D3E3F6]">
              ¿No tienes cuenta?
            </Text>
            <Pressable onPress={onRegisterPress}>
              <Text className="text-[15px] font-bold text-[#48B8FF]">
                Regístrate aquí.
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          className="rounded-[30px] border border-[#34557E] bg-[#102548]/88"
          style={{
            width: 290,
            minHeight: 300,
            paddingHorizontal: 18,
            paddingVertical: 20,
            shadowColor: '#0C1F45',
            shadowOpacity: 0.26,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <View className="items-center gap-2">
            <View
              className="items-center justify-center rounded-full border"
              style={{
                width: 62,
                height: 62,
                backgroundColor: 'rgba(138, 93, 255, 0.2)',
                borderColor: 'rgba(169, 128, 255, 0.55)',
              }}
            >
              <Ionicons name="glasses" size={28} color="#A980FF" />
            </View>

            <Text className="text-center text-[17px] font-bold text-white">
              Entrar como Invitado
            </Text>
            <Text className="text-center text-[14px] leading-7 text-[#D8E7F6]">
              Explora el contenido sin crear una cuenta. Tu progreso no se guardará.
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={onGuestPress}
            className="mt-4 w-full rounded-2xl py-4 flex-row items-center justify-center gap-2 bg-[#1C4D8D] active:bg-[#4988C4]"
          >
            <Text className="text-white font-bold text-sm">Entrar como Invitado</Text>
          </Pressable>

          <View
            style={{ marginTop: 22, minHeight: 28 }}
            className="items-center justify-center"
          >
            <Text className="text-center text-[15px] text-transparent"></Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: isDesktop ? 34 : 34 }}>
        <Divider label="o continúa con" />
      </View>

      <View
        style={{
          marginTop: 24,
          flexDirection: isDesktop ? 'row' : 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
          paddingBottom: 20,
        }}
      >
        {benefits.map((benefit) => (
          <BenefitPill
            key={benefit.title}
            benefit={benefit}
            wide={isDesktop}
          />
        ))}
      </View>
    </View>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-[#355276]" />
    </View>
  )
}

function BenefitPill({
  benefit,
  wide,
}: {
  benefit: Benefit
  wide: boolean
}) {
  return (
    <View
      className="flex-row items-center rounded-full border border-[#325072] bg-[#0A1D3E]/76"
      style={{
        width: wide ? 250 : '100%',
        maxWidth: 340,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <View className="mr-4 items-center justify-center rounded-full bg-[#173B70]">
        <View
          className="items-center justify-center rounded-full border border-[#4F78A8]"
          style={{ width: 50, height: 50 }}
        >
          <Ionicons name={benefit.icon} size={24} color="#7CC9FF" />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text className="text-[16px] font-bold text-[#F6FBFF]">{benefit.title}</Text>
        <Text className="mt-1 text-[13px] text-[#D0DFF1]">{benefit.description}</Text>
      </View>
    </View>
  )
}