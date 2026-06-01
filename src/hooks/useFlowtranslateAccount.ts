import { type FormEvent, useEffect, useState } from 'react';
import {
  isSupabaseConfigured,
  supabase,
  type Session,
} from '../lib/supabase';

export const useFlowtranslateAccount = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setEmail(data.session?.user.email || '');
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setEmail(nextSession?.user.email || '');
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const requestCode = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      setError('Supabase is not configured for this environment.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter an email address to continue.');
      return;
    }

    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setCodeSent(true);
    setCode('');
    setMessage('Check your email and enter the code here.');
  };

  const verifyCode = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      setError('Supabase is not configured for this environment.');
      return;
    }

    const token = code.trim().replace(/\s/g, '');
    if (!email.trim() || !token) {
      setError('Enter the email and code.');
      return;
    }

    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });
    setBusy(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setMessage('Signed in.');
    setCode('');
    setCodeSent(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!codeSent && !code.trim()) {
      await requestCode();
      return;
    }

    await verifyCode();
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setCode('');
    setCodeSent(false);
    setMessage('');
    setError('');
  };

  return {
    session,
    accessToken: session?.access_token || '',
    userEmail: session?.user.email || '',
    authLoading,
    isSupabaseConfigured,
    email,
    setEmail,
    code,
    setCode,
    codeSent,
    busy,
    message,
    error,
    requestCode,
    submit,
    signOut,
  };
};
