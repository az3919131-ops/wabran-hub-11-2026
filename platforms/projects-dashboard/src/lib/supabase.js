import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// عند غياب الإعداد يعمل التطبيق في وضع المعاينة المحلية (بدون حفظ)
export const supabase = url && key ? createClient(url, key) : null;
