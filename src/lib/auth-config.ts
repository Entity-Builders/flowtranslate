import {
  buildEntityBuildersAuthRedirectUrl,
  getEntityBuildersAppOrFallback,
} from '@eb-packages/app-registry';
import { createEntityAuthConfig } from '@eb-packages/auth';

const flowtranslateApp = getEntityBuildersAppOrFallback('flowtranslate');

export const flowtranslateAuthConfig = createEntityAuthConfig({
  appId: flowtranslateApp.appId,
  appName: flowtranslateApp.displayName,
  redirectTo: () =>
    buildEntityBuildersAuthRedirectUrl(
      flowtranslateApp.appId,
      window.location.origin,
    ),
  methods: [
    { type: 'email_otp', label: 'Codigo por email' },
    { type: 'oauth', provider: 'google', label: 'Continuar con Google' },
    { type: 'guest', label: 'Probar sin cuenta' },
  ],
  copy: {
    title: 'Cuenta',
    subtitle:
      'Entra con email o Google para conservar tus respuestas y Learning. Tambien podes probar sin cuenta.',
    guestStateLabel: 'Modo invitado',
    permanentStateLabel: 'Cuenta conectada',
    signOutLabel: 'Cerrar sesion',
    unavailableLabel:
      'Faltan variables de Supabase para cuentas y respuestas con IA.',
  },
  analyticsContext: {
    app: flowtranslateApp.analyticsAppId,
  },
});
