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
    { type: 'guest', label: 'Iniciar prueba gratis' },
  ],
  copy: {
    title: 'Cuenta',
    subtitle:
      'Entra con email, Google o una prueba gratis para conservar tus respuestas y Learning.',
    guestStateLabel: 'Prueba gratis',
    permanentStateLabel: 'Cuenta conectada',
    signOutLabel: 'Cerrar sesion',
    unavailableLabel:
      'Faltan variables de Supabase para cuentas y respuestas con IA.',
  },
  analyticsContext: {
    app: flowtranslateApp.analyticsAppId,
  },
});
