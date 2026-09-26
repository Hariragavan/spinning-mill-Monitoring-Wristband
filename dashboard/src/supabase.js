import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vldhjpvyphzxofmwqmys.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_UxA-HekCjNWcPPBTmlbyJg_RVErZCmK';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
