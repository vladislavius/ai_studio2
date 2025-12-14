
import { createClient } from '@supabase/supabase-js';

// --- КОНФИГУРАЦИЯ БАЗЫ ДАННЫХ ---
// 1. Зайдите в Project Settings -> API в Supabase
// 2. Скопируйте 'Project URL' и 'anon public key'
// 3. Вставьте их ниже внутри кавычек

const SUPABASE_URL = 'INSERT_YOUR_PROJECT_URL_HERE'; // Например: https://xyz.supabase.co
const SUPABASE_ANON_KEY = 'INSERT_YOUR_ANON_KEY_HERE'; // Длинная строка eyJ...

// Проверка наличия ключей
const isConfigured = SUPABASE_URL && SUPABASE_URL.includes('http') && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20;

export const supabase = isConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!isConfigured) {
  console.warn('Supabase не настроен. Приложение будет работать в Offline режиме или с ошибками подключения.');
}
