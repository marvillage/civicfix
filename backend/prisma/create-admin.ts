import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = "admin@fixity.test";
  const password = "Admin@123";

  const passwordHash = await bcrypt.hash(
    password,
    12
  );

  const existingUser =
    await prisma.user.findUnique({
      where: { email },
    });

  if (existingUser) {
    const user = await prisma.user.update({
      where: { email },
      data: {
        role: "ADMIN",
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    console.log("Admin account ready:");
    console.log(user);

    return;
  }

  const user = await prisma.user.create({
    data: {
      name: "Fixity Admin",
      email,
      passwordHash,
      role: "ADMIN",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log("Admin account created:");
  console.log(user);
}

main()
  .catch((error) => {
    console.error(
      "Failed to create admin:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });