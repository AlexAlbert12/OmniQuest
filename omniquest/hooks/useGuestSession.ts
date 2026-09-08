import type { Session, User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type GuestSessionState = {
  alias: string
  isGuest: boolean
  ready: boolean
  userId: string | null
}

const INITIAL_STATE: GuestSessionState = {
  alias: 'Invitado',
  isGuest: false,
  ready: false,
  userId: null,
}

export function isGuestUser(user: User | null | undefined) {
  return Boolean(user?.is_anonymous)
}

export function getGuestAlias(user: User | null | undefined) {
  if (!isGuestUser(user)) return 'Invitado'
  const alias = typeof user?.user_metadata?.alias === 'string'
    ? user.user_metadata.alias.trim()
    : ''
  return alias ? alias.slice(0, 30) : 'Invitado'
}

export function useGuestSession(): GuestSessionState {
  const [state, setState] = useState<GuestSessionState>(INITIAL_STATE)

  useEffect(() => {
    let mounted = true

    const applySession = (session: Session | null) => {
      if (!mounted) return
      setState({
        alias: getGuestAlias(session?.user),
        isGuest: isGuestUser(session?.user),
        ready: true,
        userId: session?.user.id || null,
      })
    }

    void supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}
