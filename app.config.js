// app.config.js replaces app.json so we can pull secrets from environment
// variables (see .env.example) instead of committing them to git.
require('dotenv').config();

module.exports = {
  expo: {
    name: 'Reloved',
    slug: 'reloved',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: { backgroundColor: '#ffffff' },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.reloved.app',
    },
    android: {
      package: 'com.reloved.app',
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
};
