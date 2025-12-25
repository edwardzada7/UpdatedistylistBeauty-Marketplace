import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://gvmomyoeokauuixsydiu.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_lH31VwQm8hlT5ajeFgvkIw_91kg8P72';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
