import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Json } from '../types/database.types'
import { trackUsageEvent } from '../lib/analytics'

export function useFormAnalytics(
  formName: string,
  initialContext: Record<string, Json | undefined> = {},
) {
  const startedRef = useRef(false)
  const completedRef = useRef(false)
  const contextRef = useRef(initialContext)

  const markStarted = useCallback((context: Record<string, Json | undefined> = {}) => {
    startedRef.current = true
    contextRef.current = { ...contextRef.current, ...context }
  }, [])

  const updateContext = useCallback((context: Record<string, Json | undefined>) => {
    contextRef.current = { ...contextRef.current, ...context }
  }, [])

  const markCompleted = useCallback(() => {
    completedRef.current = true
  }, [])

  useEffect(() => {
    return () => {
      if (!startedRef.current || completedRef.current) return
      void trackUsageEvent('form_abandoned', {
        properties: {
          form_name: formName,
          ...contextRef.current,
        },
      })
    }
  }, [formName])

  return useMemo(
    () => ({ markCompleted, markStarted, updateContext }),
    [markCompleted, markStarted, updateContext],
  )
}
