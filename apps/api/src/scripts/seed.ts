import mongoose from 'mongoose';
import prompts from 'prompts';
import { passwordSchema, phoneSchema } from '@vastu/contracts';
import { env } from '@/config/env.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';

/**
 * Operator-run, idempotent first-time setup:
 *   dev:  pnpm --filter @vastu/api seed
 *   prod: node dist/scripts/seed.js        (inside the container / on the VPS)
 *
 *  1. Adds any missing default designations (never touches existing ones).
 *  2. Creates the first Admin if none exists, asking for the password interactively — it is
 *     deliberately never read from `.env`, so no plaintext admin password sits on disk.
 */
async function main() {
  await mongoose.connect(env.MONGO_URI);
  const { bootstrap } = buildIdentityContainer();

  const added = await bootstrap.seedDesignations.execute();
  console.warn(
    added.length ? `Added designations: ${added.join(', ')}` : 'Designations already seeded.',
  );

  if (await mongoose.model('User').exists({ role: 'ADMIN', active: true })) {
    console.warn('An Admin already exists — nothing more to do.');
    return;
  }

  const answers = await prompts(
    [
      {
        type: 'text',
        name: 'name',
        message: 'Admin name',
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
      {
        type: 'text',
        name: 'phone',
        message: 'Admin phone (10 digits, used to sign in)',
        validate: (v: string) =>
          phoneSchema.safeParse(v).success || 'Enter a valid 10-digit mobile number',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password (min 8 characters)',
        validate: (v: string) =>
          passwordSchema.safeParse(v).success || 'At least 8 characters (max 72 bytes)',
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  const admin = await bootstrap.createAdmin.execute({
    name: String(answers['name']).trim(),
    phone: phoneSchema.parse(answers['phone']),
    password: String(answers['password']),
  });
  console.warn(
    `Admin created: ${admin.name} (${admin.phone}). Sign in with the phone number and your password.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
