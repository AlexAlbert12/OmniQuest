import React from 'react'
import { useResponsiveLayout } from '../../lib/responsive'
import RoleScreenLayout from './RoleScreenLayout'

type Props = Omit<React.ComponentProps<typeof RoleScreenLayout>, 'role'>

export default function TeacherScreenLayout({
  fluidContent = true,
  horizontalPadding,
  isDesktop: isDesktopOverride,
  topPadding,
  ...props
}: Props) {
  const responsive = useResponsiveLayout()
  const isDesktop = isDesktopOverride ?? responsive.isDesktop

  return (
    <RoleScreenLayout
      {...props}
      role="teacher"
      fluidContent={fluidContent}
      horizontalPadding={horizontalPadding ?? (isDesktop ? 28 : 18)}
      isDesktop={isDesktop}
      topPadding={topPadding ?? (isDesktop ? 24 : 18)}
    />
  )
}
