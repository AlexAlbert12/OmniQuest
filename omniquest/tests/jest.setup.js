jest.mock('@expo/vector-icons', () => {
  const MockIonicons = () => null
  return { Ionicons: MockIonicons }
})

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-linear-gradient', () => {
  const MockLinearGradient = ({ children }) => children ?? null
  return { LinearGradient: MockLinearGradient }
})
