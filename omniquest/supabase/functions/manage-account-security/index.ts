import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return methodNotAllowedResponse()
  try{
    const url=Deno.env.get('SUPABASE_URL'), service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!service) return publicErrorResponse('Servicio no configurado.',500,'service_unavailable')
    const auth=req.headers.get('Authorization')||''
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=auth.replace(/^Bearer\s+/i,''); const {data:userData,error:userError}=await admin.auth.getUser(token)
    if(userError||!userData.user) return publicErrorResponse('No autorizado.',401,'unauthorized')
    const userId=userData.user.id
    const {data:profile}=await admin.from('profiles').select('role_id,active').eq('id',userId).maybeSingle()
    if(!profile||profile.active===false||!['student','teacher','admin'].includes(profile.role_id)) return publicErrorResponse('Acceso restringido.',403,'forbidden')
    const body=await req.json().catch(()=>({})) as {action?:string;sessionId?:string;currentDeviceId?:string}
    if(body.action==='list_sessions'){
      const {data,error}=await admin.from('user_sessions').select('id,device_id,device_name,platform,first_seen_at,last_seen_at,revoked_at').eq('user_id',userId).order('last_seen_at',{ascending:false}); if(error) throw error
      const {count}=await admin.from('account_backup_codes').select('id',{count:'exact',head:true}).eq('user_id',userId).is('used_at',null)
      return json({sessions:data||[],backupCodesRemaining:count||0})
    }
    if(body.action==='revoke_session'){
      if(!body.sessionId) return publicErrorResponse('Falta la sesión.',400,'invalid_request')
      const {error}=await admin.from('user_sessions').update({revoked_at:new Date().toISOString(),revoked_by:userId,updated_at:new Date().toISOString()}).eq('id',body.sessionId).eq('user_id',userId); if(error) throw error
      return json({ok:true})
    }
    if(body.action==='revoke_others'){
      let q=admin.from('user_sessions').update({revoked_at:new Date().toISOString(),revoked_by:userId,updated_at:new Date().toISOString()}).eq('user_id',userId).is('revoked_at',null)
      if(body.currentDeviceId) q=q.neq('device_id',body.currentDeviceId)
      const {error}=await q; if(error) throw error
      return json({ok:true})
    }
    if(body.action==='generate_backup_codes'){
      const codes=Array.from({length:10},()=>randomCode())
      const rows=[]
      for(const code of codes) rows.push({user_id:userId,code_hash:await hash(code)})
      const {error:deleteError}=await admin.from('account_backup_codes').delete().eq('user_id',userId); if(deleteError) throw deleteError
      const {error:insertError}=await admin.from('account_backup_codes').insert(rows); if(insertError) throw insertError
      await admin.rpc('create_notification',{p_user_id:userId,p_audience:profile.role_id==='admin'?'admin':profile.role_id==='teacher'?'teacher':'student',p_type:'announcement',p_title:'Códigos de respaldo renovados',p_description:'Se han generado nuevos códigos de recuperación. Los anteriores ya no son válidos.',p_icon:'key-outline',p_color:'#9FD6FF',p_action_url:null,p_related_table:'account_backup_codes',p_related_id:userId,p_metadata:{count:codes.length},p_fingerprint:`backup-codes:${userId}:${Date.now()}`})
      return json({codes})
    }
    return publicErrorResponse('Acción no soportada.',400,'invalid_action')
  }catch(e){return errorResponse(e,'No se pudo gestionar la seguridad de la cuenta.',{functionName:'manage-account-security'})}
})
function randomCode(){let out=''; const bytes=crypto.getRandomValues(new Uint8Array(12)); for(const b of bytes) out+=alphabet[b%alphabet.length]; return `${out.slice(0,4)}-${out.slice(4,8)}-${out.slice(8,12)}`}
async function hash(value:string){const bytes=new TextEncoder().encode(value); const digest=await crypto.subtle.digest('SHA-256',bytes); return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
