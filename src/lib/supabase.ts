import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xpmwkdzoryhipwfmjrrh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwbXdrZHpvcnloaXB3Zm1qcnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDU0MjYsImV4cCI6MjA5MDAyMTQyNn0.JUkN7JCDXUAPY3xXaGBLp2m77fGXzIwmbQFM0jWMoVI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
