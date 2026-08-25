import React from 'react'
import { StyleSheet } from 'react-native'
import { Image, type ImageProps } from 'expo-image'

export type AvatarImageProps = Omit<ImageProps, 'source'> & {
  uri: string
}

export default function AvatarImage({ uri, style, ...props }: AvatarImageProps) {
  return (
    <Image
      {...props}
      source={{ uri }}
      recyclingKey={uri}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={120}
      style={[styles.image, style]}
    />
  )
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
})
