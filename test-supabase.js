const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://placeholder.supabase.co', 'placeholder');

async function test() {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('Error object:', error);
  } catch (err) {
    console.log('Caught exception:', err);
  }
}

test();
