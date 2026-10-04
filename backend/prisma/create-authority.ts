import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = "authority@fixity.test";
  const password = "Authority@123";

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
        role: "AUTHORITY",
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    console.log(
      "Authority account ready:"
    );
    console.log(user);

    return;
  }

  const user = await prisma.user.create({
    data: {
      name: "Fixity Authority",
      email,
      passwordHash,
      role: "AUTHORITY",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log(
    "Authority account created:"
  );
  console.log(user);
}

main()
  .catch((error) => {
    console.error(
      "Failed to create Authority:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });