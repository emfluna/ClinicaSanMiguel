import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oftmitifilkscxhufrcf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdG1pdGlmaWxrc2N4aHVmcmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjk1NjksImV4cCI6MjA4MzkwNTU2OX0.r3JV2CBeUC5FGUbBgdMFF1UAGiEOBA-jFOi5rJ-F2aQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
