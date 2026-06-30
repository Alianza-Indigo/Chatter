/**
 * Seed de desarrollo: crea el tenant `default` y dos tenants demo.
 * Ejecutar con: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const homeserver = process.env.MATRIX_DEFAULT_HOMESERVER_URL ?? 'http://localhost:8008';
const serverName = process.env.MATRIX_DEFAULT_SERVER_NAME ?? 'whalabi.local';

async function main(): Promise<void> {
  await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Whalabi',
      slug: 'default',
      publicDomain: 'localhost',
      matrixBaseUrl: homeserver,
      matrixServerName: serverName,
      botEnabled: true,
      botUserId: `@whalabi-bot:${serverName}`,
      botResponseMode: 'mention',
      llmProvider: 'dummy',
      llmModel: 'gpt-4o-mini',
      allowRegistration: true,
      tagline: 'El chat privado de tu organización.',
    },
  });

  await prisma.tenant.upsert({
    where: { slug: 'clinica-demo' },
    update: {},
    create: {
      name: 'Clínica Demo',
      slug: 'clinica-demo',
      publicDomain: 'chat.clinica-demo.mx',
      matrixBaseUrl: homeserver,
      matrixServerName: serverName,
      botEnabled: true,
      botUserId: `@whalabi-bot:${serverName}`,
      botResponseMode: 'mention',
      botSystemPrompt:
        'Eres el asistente interno de Clínica Demo. Ayuda con dudas administrativas. ' +
        'No des consejo médico. No inventes políticas. Si no sabes algo, dilo.',
      llmProvider: 'dummy',
      llmModel: 'gpt-4o-mini',
      primaryColor: '#0ea5e9',
      accentColor: '#a78bfa',
      allowRegistration: false,
      tagline: 'Comunicación interna de la clínica.',
    },
  });

  await prisma.tenant.upsert({
    where: { slug: 'despacho-demo' },
    update: {},
    create: {
      name: 'Despacho Demo',
      slug: 'despacho-demo',
      publicDomain: 'chat.despacho-demo.com',
      matrixBaseUrl: homeserver,
      matrixServerName: serverName,
      botEnabled: false,
      botResponseMode: 'mention',
      llmProvider: 'dummy',
      allowRegistration: false,
      primaryColor: '#4338ca',
      accentColor: '#a78bfa',
      tagline: 'Comunicación legal privada.',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed completado: default, clinica-demo, despacho-demo');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
