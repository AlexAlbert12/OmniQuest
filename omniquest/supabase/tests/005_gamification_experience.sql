begin;

select plan(15);

select has_column('public', 'user_preferences', 'haptics_enabled', 'user preferences expose configurable haptics');
select col_default_is('public', 'user_preferences', 'haptics_enabled', 'true', 'haptics are enabled by default');
select has_table('public', 'avatar_frames', 'avatar frame catalog exists');
select has_table('public', 'profile_cosmetics', 'profile cosmetics table exists');
select has_column('public', 'profile_cosmetics', 'equipped_frame_key', 'equipped frame is stored');
select has_column('public', 'profile_cosmetics', 'featured_badge_id', 'featured badge is stored');
select has_function('public', 'get_profile_cosmetics', array['uuid[]'], 'safe profile cosmetics lookup exists');
select has_function('public', 'get_avatar_customization_options', array[]::text[], 'avatar customization options RPC exists');
select has_function('public', 'equip_profile_cosmetics', array['text', 'text'], 'server-validated equip RPC exists');
select function_returns('public', 'get_avatar_customization_options', array[]::text[], 'jsonb', 'customization options return JSON');
select function_returns('public', 'equip_profile_cosmetics', array['text', 'text'], 'jsonb', 'equip RPC returns JSON');
select row_security_active('public', 'avatar_frames', 'avatar frame catalog uses RLS');
select row_security_active('public', 'profile_cosmetics', 'profile cosmetics use RLS');
select policies_are('public', 'avatar_frames', array['avatar_frames_authenticated_read'], 'avatar frame policies are explicit');
select policies_are('public', 'profile_cosmetics', array['profile_cosmetics_read_own'], 'cosmetics direct reads are limited to owner');

select * from finish();
rollback;
