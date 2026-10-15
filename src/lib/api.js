import axios from 'axios';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// One axios instance for the FastAPI backend. The request interceptor runs
// before every call and attaches the current Supabase session token, so
// screens never have to think about auth headers.
export const api = axios.create({
  baseURL: Constants.expoConfig.extra.apiUrl,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
