-- MANUAL FIX USERNAME
-- Ganti 'email_anda@example.com' dengan email yang Anda pakai untuk register.
-- Ganti 'satri' dengan username yang Anda inginkan.

UPDATE public.users
SET 
  username = 'satri',
  full_name = 'satri',
  membership_status = 'free' -- Pastikan status aktif
WHERE email = 'satriaaldino45@gmail.com'; -- GANTI EMAIL INI DENGAN EMAIL ANDA JIKA BERBEDA

-- Cek hasilnya
SELECT * FROM public.users WHERE email = 'satriaaldino45@gmail.com';
