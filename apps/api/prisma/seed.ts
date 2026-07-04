/**
 * Seed de desarrollo: crea la organización general "Whalabi" (sin código).
 * Ejecutar con: pnpm db:seed
 *
 * Las demás organizaciones se crean desde el panel admin (con o sin código).
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
      // Organización general: sin código y accesible por el dominio principal.
      publicDomain: 'localhost',
      code: null,
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

  // eslint-disable-next-line no-console
  console.log('Seed completado: organización general "Whalabi" (sin código).');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
