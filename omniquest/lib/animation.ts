import { Platform } from 'react-native'

/** React Native Web has no native Animated module and must use the JS driver. */
export const USE_NATIVE_ANIMATION_DRIVER = Platform.OS !== 'web'
