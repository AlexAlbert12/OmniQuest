import { View } from 'react-native'
import RolePageHeader, { type RolePageHeaderProps } from '../ui/RolePageHeader'
import GlobalSearchButton from '../search/GlobalSearchButton'

export type TeacherPageHeaderProps = Omit<RolePageHeaderProps, 'role'> & {
  showGlobalSearch?: boolean
}

export default function TeacherPageHeader({ utilityActions, showGlobalSearch = true, ...props }: TeacherPageHeaderProps) {
  const resolvedUtilityActions = showGlobalSearch || utilityActions ? (
    <View className="flex-row items-center gap-2">
      {showGlobalSearch ? <GlobalSearchButton role="teacher" compact={!props.isDesktop} /> : null}
      {utilityActions}
    </View>
  ) : undefined

  return <RolePageHeader role="teacher" {...props} utilityActions={resolvedUtilityActions} />
}
