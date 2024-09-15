export default {
  expo: {
    name: 'Bayaan',
    slug: 'bayaan',
    scheme: 'bayaan',
    version: '1.0.0',
    extra: {
      // Add your environment variables here
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      postmarkApiKey: process.env.POSTMARK_API_KEY,
      postmarkFromEmail: process.env.POSTMARK_FROM_EMAIL,
      eas: {
        projectId: 'e079f57f-241e-4180-a227-5d7da83c5d06',
      },
    },
  },
};
