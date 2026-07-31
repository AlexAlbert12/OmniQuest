import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type PlatformRpcResult<T> = {
  data: T | null
  error: PostgrestError | null
}

type RawRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: PostgrestError | null }>

const rawRpc = supabase.rpc.bind(supabase) as unknown as RawRpc

export async function callPlatformRpc<T>(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<PlatformRpcResult<T>> {
  const result = await rawRpc(functionName, args)
  return {
    data: result.data as T | null,
    error: result.error,
  }
}
