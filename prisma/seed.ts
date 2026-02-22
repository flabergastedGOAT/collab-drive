import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const alice = await db.user.upsert({
    where: { rollNo: 'SP25-BCS-064-A' },
    update: {},
    create: {
      rollNo: 'SP25-BCS-064-A',
      password: await bcrypt.hash('password123', 10),
      name: 'Alice',
    },
  });

  const bob = await db.user.upsert({
    where: { rollNo: 'SP25-BCS-064-B' },
    update: {},
    create: {
      rollNo: 'SP25-BCS-064-B',
      password: await bcrypt.hash('password123', 10),
      name: 'Bob',
    },
  });

  let space = await db.space.findFirst({ where: { name: 'Sample Team Space' } });
  if (!space) {
    space = await db.space.create({
      data: {
        name: 'Sample Team Space',
        ownerId: alice.id,
        members: {
          create: [
            { userId: alice.id, role: 'admin' },
            { userId: bob.id, role: 'member' },
          ],
        },
      },
    });
    await db.activityLog.create({
      data: {
        spaceId: space.id,
        userId: alice.id,
        action: 'space_create',
        target: 'Sample Team Space',
      },
    });
  }

  console.log('Seed complete. Login with SP25-BCS-064-A / password123 or SP25-BCS-064-B / password123');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
