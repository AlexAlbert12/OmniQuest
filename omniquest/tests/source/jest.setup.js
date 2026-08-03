const React = require('react')
const { Text, View } = require('react-native')

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, ...props }) => React.createElement(Text, { ...props, testID: `icon-${name}` }, name),
}))

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }) => React.createElement(View, props, children),
}))
