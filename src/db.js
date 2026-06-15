import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qfboinikicjlevwvujuz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYm9pbmlraWNqbGV2d3Z1anV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ1NjAzNSwiZXhwIjoyMDk2MDMyMDM1fQ.uynGGpN0h2O9fxi_SpS_mZDhWA7gBr--J_DsFpXyZDA';

export const db = createClient(supabaseUrl, supabaseAnonKey);