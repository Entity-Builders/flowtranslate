import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  isSupabaseConfigured,
  supabase,
  type Session,
} from '../lib/supabase';
import type { Profile } from '@eb-packages/flowtranslate-core';
import { analytics } from '../services/analytics';

export type FlowtranslateAccountKind = 'none' | 'guest' | 'permanent';
type GuestSignInSource = 'automatic' | 'manual';
type GuestSignInOptions = {
  source?: GuestSignInSource;
};

type AuthAnalyticsError = {
  name?: string;
  status?: number;
  code?: string;
};

const OAUTH_LINKED_IDENTITY_ERROR = 'identity_already_exists';

const authErrorProperties = (error: AuthAnalyticsError) => ({
  error_type: error.name || 'auth_error',
  error_status: typeof error.status === 'number' ? error.status : null,
  error_code: error.code || null,
});

const isAnonymousSession = (session: Session | null) =>
  (session?.user as { is_anonymous?: boolean | null } | undefined)
    ?.is_anonymous === true;

const readOAuthErrorFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const errorCode =
    params.get('error_code') ||
    hashParams.get('error_code') ||
    params.get('error') ||
    hashParams.get('error') ||
    '';
  const errorDescription =
    params.get('error_description') ||
    hashParams.get('error_description') ||
    '';

  return { errorCode, errorDescription };
};

const clearOAuthErrorFromUrl = () => {
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState(
    window.history.state,
    document.title,
    window.location.pathname,
  );
};

export const useFlowtranslateAccount = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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

  useEffect(() => {
    if (!supabase) return;

    if (!session?.user) {
      setProfile(null);
      return;
    }

    let mounted = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setProfile(data as Profile);
      });

    return () => {
      mounted = false;
    };
  }, [session?.user]);

  useEffect(() => {
    if (!supabase) return;

    const { errorCode, errorDescription } = readOAuthErrorFromUrl();
    if (!errorCode) return;

    analytics.track('auth_oauth_returned_error', {
      provider: 'google',
      error_code: errorCode,
      has_error_description: Boolean(errorDescription),
    });

    clearOAuthErrorFromUrl();

    if (errorCode === OAUTH_LINKED_IDENTITY_ERROR) {
      void supabase.auth.signOut();
      setSession(null);
      setError(
        'Ese Google ya esta conectado a otra cuenta. Cerramos la prueba gratis; toca Google de nuevo para entrar con esa cuenta.',
      );
      return;
    }

    setError(
      errorDescription ||
        'No pudimos terminar el inicio con Google. Proba de nuevo.',
    );
  }, []);

  const requestCode = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      analytics.track('auth_code_request_blocked', {
        reason: 'supabase_not_configured',
      });
      setError('Supabase no esta configurado en este entorno.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      analytics.track('auth_code_request_blocked', {
        reason: 'missing_email',
      });
      setError('Ingresa un email para continuar.');
      return;
    }

    setBusy(true);
    analytics.track('auth_code_request_submitted', {
      method: 'email_otp',
    });
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);

    if (signInError) {
      analytics.track('auth_code_request_failed', {
        method: 'email_otp',
        ...authErrorProperties(signInError),
      });
      setError(signInError.message);
      return;
    }

    analytics.track('auth_code_request_succeeded', {
      method: 'email_otp',
    });
    setCodeSent(true);
    setCode('');
    setMessage('Revisa tu email e ingresa el codigo aca.');
  };

  const verifyCode = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      analytics.track('auth_code_verification_blocked', {
        reason: 'supabase_not_configured',
      });
      setError('Supabase no esta configurado en este entorno.');
      return;
    }

    const token = code.trim().replace(/\s/g, '');
    if (!email.trim() || !token) {
      analytics.track('auth_code_verification_blocked', {
        reason: 'missing_credentials',
      });
      setError('Ingresa el email y el codigo.');
      return;
    }

    setBusy(true);
    analytics.track('auth_code_verification_submitted', {
      method: 'email_otp',
    });
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });
    setBusy(false);

    if (verifyError) {
      analytics.track('auth_code_verification_failed', {
        method: 'email_otp',
        ...authErrorProperties(verifyError),
      });
      setError(verifyError.message);
      return;
    }

    analytics.track('auth_code_verification_succeeded', {
      method: 'email_otp',
    });
    setMessage('Cuenta conectada.');
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

  const accountKind: FlowtranslateAccountKind = !session
    ? 'none'
    : isAnonymousSession(session)
      ? 'guest'
      : 'permanent';

  const signInAsGuest = useCallback(async (options: GuestSignInOptions = {}) => {
    const source = options.source || 'manual';
    setError('');
    setMessage('');

    if (!supabase) {
      analytics.track('auth_guest_blocked', {
        reason: 'supabase_not_configured',
        source,
      });
      setError('Supabase no esta configurado en este entorno.');
      return;
    }

    setBusy(true);
    analytics.track('auth_guest_submitted', {
      method: 'anonymous',
      source,
    });

    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    setBusy(false);

    if (signInError) {
      analytics.track('auth_guest_failed', {
        method: 'anonymous',
        source,
        ...authErrorProperties(signInError),
      });
      setError(signInError.message);
      return;
    }

    if (data.session) {
      setSession(data.session);
      setEmail(data.session.user.email || '');
    }

    analytics.track('auth_guest_succeeded', {
      method: 'anonymous',
      source,
    });
    setCode('');
    setCodeSent(false);
    setMessage(source === 'manual' ? 'Tu prueba gratis esta lista.' : '');
  }, []);

  const signInWithGoogle = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      analytics.track('auth_oauth_blocked', {
        provider: 'google',
        reason: 'supabase_not_configured',
      });
      setError('Supabase no esta configurado en este entorno.');
      return;
    }

    const method = accountKind === 'guest' ? 'google_oauth_from_guest' : 'google_oauth';
    const redirectTo = window.location.origin;

    setBusy(true);
    analytics.track('auth_oauth_submitted', {
      provider: 'google',
      method,
      account_kind: accountKind,
    });

    if (accountKind === 'guest') {
      await supabase.auth.signOut();
      setSession(null);
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    setBusy(false);

    if (oauthError) {
      analytics.track('auth_oauth_failed', {
        provider: 'google',
        method,
        account_kind: accountKind,
        ...authErrorProperties(oauthError),
      });
      setError(oauthError.message);
      return;
    }

    analytics.track('auth_oauth_started', {
      provider: 'google',
      method,
      account_kind: accountKind,
    });
    setMessage(
      accountKind === 'guest'
        ? 'Continua con Google para entrar con tu cuenta.'
        : 'Continua con Google para terminar el inicio de sesion.',
    );
  };

  const signOut = async () => {
    const signedOutAccountKind = accountKind;
    await supabase?.auth.signOut();
    analytics.track('auth_signed_out', {
      account_kind: signedOutAccountKind,
    });
    setSession(null);
    setCode('');
    setCodeSent(false);
    setMessage('');
    setError('');
  };

  const updateGlobalContext = async (context: string) => {
    setError('');
    setMessage('');

    if (!session?.user || !supabase) {
      setError('Necesitas una cuenta conectada para guardar tu perfil.');
      return false;
    }

    const cleanContext = context.trim() || null;
    setBusy(true);
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ global_context: cleanContext })
      .eq('user_id', session.user.id)
      .select()
      .maybeSingle();
    setBusy(false);

    if (updateError) {
      analytics.track('profile_context_update_failed', {
        account_kind: accountKind,
        error_type: updateError.name || 'profile_update_error',
        error_code: updateError.code || null,
      });
      setError('No pudimos guardar tu perfil. Proba de nuevo.');
      return false;
    }

    if (data && !updateError) {
      setProfile(data as Profile);
    }

    analytics.track('profile_context_updated', {
      account_kind: accountKind,
      has_context: Boolean(cleanContext),
      context_chars: cleanContext?.length || 0,
    });
    return true;
  };

  return {
    session,
    profile,
    accessToken: session?.access_token || '',
    userEmail: session?.user.email || '',
    displayName:
      accountKind === 'guest' ? 'Prueba gratis' : session?.user.email || 'Cuenta',
    accountKind,
    isGuest: accountKind === 'guest',
    isPermanent: accountKind === 'permanent',
    authLoading,
    isSupabaseConfigured,
    currentStreak: profile?.current_streak || 0,
    globalContext: profile?.global_context || '',
    updateGlobalContext,
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
    signInAsGuest,
    signInWithGoogle,
    signOut,
  };
};
