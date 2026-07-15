import React from 'react'
import { RoleSettingsSections, type RoleSettingsSectionsProps } from './StudentSettingsSections'

export default function TeacherSettingsSections(props: Omit<RoleSettingsSectionsProps, 'isTeacher'>) {
  return <RoleSettingsSections {...props} isTeacher />
}
