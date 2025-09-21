import supabase from '../database/supabase-client.js';

export async function upsertUser(supabaseUser) {
  if (!supabaseUser) {
    console.warn('upsertUser called with null/undefined user');
    return;
  }
  
  const { id, email, raw_user_meta_data, user_metadata, created_at, updated_at } = supabaseUser;
  
  if (!id || !email) {
    console.warn('upsertUser called with incomplete user data:', { id, email });
    return;
  }
  
  const meta = raw_user_meta_data || user_metadata || {};
  const full_name = meta.full_name || meta.name || null;
  const avatar_url = meta.avatar_url || meta.picture || null;
  
  try {
    const { error } = await supabase.from('users').upsert([
      {
        id,
        email,
        full_name,
        avatar_url,
        created_at: created_at || new Date().toISOString(),
        updated_at: updated_at || new Date().toISOString(),
        is_active: true,
        role: 'student'
      }
    ], { onConflict: 'id' });
    
    if (error) {
      console.error('User upsert error for user', email, ':', error);
      throw error;
    }
    
    console.log('Successfully synced user:', email);
  } catch (error) {
    console.error('User upsert error:', error);
    throw error;
  }
}