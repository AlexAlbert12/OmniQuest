import React, { useCallback } from 'react'
import { FlatList, Platform, type ListRenderItem, type StyleProp, View, type ViewStyle } from 'react-native'

type VirtualizedStackProps<T> = {
  data: readonly T[]
  keyExtractor: (item: T, index: number) => string
  renderItem: (item: T, index: number) => React.ReactElement | null
  emptyComponent?: React.ReactElement | null
  footerComponent?: React.ReactElement | null
  headerComponent?: React.ReactElement | null
  gap?: number
  scrollEnabled?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export default function VirtualizedStack<T>({
  accessibilityLabel,
  contentContainerStyle,
  data,
  emptyComponent = null,
  footerComponent = null,
  gap = 12,
  headerComponent = null,
  keyExtractor,
  renderItem,
  scrollEnabled = false,
}: VirtualizedStackProps<T>) {
  const renderRow: ListRenderItem<T> = useCallback(({ item, index }) => renderItem(item, index), [renderItem])
  const separator = useCallback(() => <View style={{ height: gap }} />, [gap])

  return (
    <FlatList<T>
      accessibilityLabel={accessibilityLabel}
      style={Platform.OS === 'web' && !scrollEnabled ? ({ touchAction: 'pan-y' } as any) : undefined}
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      ItemSeparatorComponent={separator}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={footerComponent}
      ListHeaderComponent={headerComponent}
      scrollEnabled={scrollEnabled}
      nestedScrollEnabled={scrollEnabled}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={40}
      windowSize={7}
      removeClippedSubviews={scrollEnabled}
      contentContainerStyle={contentContainerStyle}
    />
  )
}
