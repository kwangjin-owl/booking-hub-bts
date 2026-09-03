import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hdvfzyxwzlrcxfqgfzkq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkdmZ6eXh3emxyY3hmcWdmemtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMTQ1MDgsImV4cCI6MjEwMzg5MDUwOH0.4dAN_ldPKbvQob7CSAHhO0MeCxm2dHIkUnmOZilXJrY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
