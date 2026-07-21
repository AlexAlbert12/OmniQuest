import { View } from 'react-native'
import RolePageHeader, { type RolePageHeaderProps } from '../ui/RolePageHeader'
import GlobalSearchButton from '../search/GlobalSearchButton'

export type TeacherPageHeaderProps = Omit<RolePageHeaderProps, 'role'>

/** Teacher-role wrapper around the shared authenticated page header. */
export default function TeacherPageHeader({ utilityActions, ...props }: TeacherPageHeaderProps) {
  return (
    <RolePageHeader
      role="teacher"
      {...props}
      utilityActions={
        <View className="flex-row items-center gap-2">
          <GlobalSearchButton role="teacher" compact={!props.isDesktop} />
          {utilityActions}
        </View>
      }
    />
  )
}
