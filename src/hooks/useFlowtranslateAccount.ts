import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  isSupabaseConfigured,
  supabase,
  type Session,
} from '../lib/supabase';
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

const authErrorProperties = (error: AuthAnalyticsError) => ({
  error_type: error.name || 'auth_error',
  error_status: typeof error.status === 'number' ? error.status : null,
  error_code: error.code || null,
});

const isAnonymousSession = (session: Session | null) =>
  (session?.user as { is_anonymous?: boolean | null } | undefined)
    ?.is_anonymous === true;

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
      analytics.track('auth_code_request_blocked', {
        reason: 'supabase_not_configured',
      });
      setError('Supabase is not configured for this environment.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      analytics.track('auth_code_request_blocked', {
        reason: 'missing_email',
      });
      setError('Enter an email address to continue.');
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
    setMessage('Check your email and enter the code here.');
  };

  const verifyCode = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      analytics.track('auth_code_verification_blocked', {
        reason: 'supabase_not_configured',
      });
      setError('Supabase is not configured for this environment.');
      return;
    }

    const token = code.trim().replace(/\s/g, '');
    if (!email.trim() || !token) {
      analytics.track('auth_code_verification_blocked', {
        reason: 'missing_credentials',
      });
      setError('Enter the email and code.');
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
      setError('Supabase is not configured for this environment.');
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
    setMessage(source === 'manual' ? 'Guest trial is ready.' : '');
  }, []);

  const signInWithGoogle = async () => {
    setError('');
    setMessage('');

    if (!supabase) {
      analytics.track('auth_oauth_blocked', {
        provider: 'google',
        reason: 'supabase_not_configured',
      });
      setError('Supabase is not configured for this environment.');
      return;
    }

    const method = accountKind === 'guest' ? 'google_link' : 'google_oauth';
    const redirectTo = window.location.origin;

    setBusy(true);
    analytics.track('auth_oauth_submitted', {
      provider: 'google',
      method,
      account_kind: accountKind,
    });

    const { error: oauthError } =
      accountKind === 'guest'
        ? await supabase.auth.linkIdentity({
            provider: 'google',
            options: { redirectTo },
          })
        : await supabase.auth.signInWithOAuth({
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
        ? 'Finish with Google to connect this guest trial.'
        : 'Continue with Google to finish signing in.',
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

  return {
    session,
    accessToken: session?.access_token || '',
    userEmail: session?.user.email || '',
    displayName:
      accountKind === 'guest' ? 'Guest trial' : session?.user.email || 'Account',
    accountKind,
    isGuest: accountKind === 'guest',
    isPermanent: accountKind === 'permanent',
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
    signInAsGuest,
    signInWithGoogle,
    signOut,
  };
};
