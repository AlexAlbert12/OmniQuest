jest.mock('@expo/vector-icons', () => {
  const MockIonicons = () => null
  return { Ionicons: MockIonicons }
})

jest.mock('expo-linear-gradient', () => {
  const MockLinearGradient = ({ children }) => children ?? null
  return { LinearGradient: MockLinearGradient }
})
