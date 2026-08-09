import React, { forwardRef, useMemo } from 'react'
import { Text as NativeText, TextInput as NativeTextInput } from 'react-native'
import { cssInterop } from 'nativewind'
import { translateUiText, useI18n } from '../../lib/i18n'

type NativeTextProps = React.ComponentProps<typeof NativeText>
type NativeTextInputProps = React.ComponentProps<typeof NativeTextInput>

function localizeChildren(children: React.ReactNode, locale: ReturnType<typeof useI18n>['locale']): React.ReactNode {
  if (typeof children === 'string') return translateUiText(locale, children)
  if (Array.isArray(children)) return children.map((child) => localizeChildren(child, locale))
  return children
}

export const LocalizedText = forwardRef<any, NativeTextProps>(function LocalizedText({ children, ...props }, ref) {
  const { locale } = useI18n()
  const localizedChildren = useMemo(() => localizeChildren(children, locale), [children, locale])
  return <NativeText ref={ref} {...props}>{localizedChildren}</NativeText>
})

export const LocalizedTextInput = forwardRef<any, NativeTextInputProps>(function LocalizedTextInput(props, ref) {
  const { locale } = useI18n()
  const placeholder = typeof props.placeholder === 'string' ? translateUiText(locale, props.placeholder) : props.placeholder
  const accessibilityLabel = typeof props.accessibilityLabel === 'string' ? translateUiText(locale, props.accessibilityLabel) : props.accessibilityLabel
  const accessibilityHint = typeof props.accessibilityHint === 'string' ? translateUiText(locale, props.accessibilityHint) : props.accessibilityHint
  return <NativeTextInput ref={ref} {...props} placeholder={placeholder} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} />
})

cssInterop(LocalizedText, { className: 'style' })
cssInterop(LocalizedTextInput, { className: 'style' })
