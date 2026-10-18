import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

const contractGlob = `${import.meta.dirname.replaceAll("\\", "/")}/prisma/**/*.prisma`;

export default definePrismaConfig({
  orm: ormConfig({
    contract: contractGlob,
    db: {
      connection: process.env["DATABASE_URL"]!,
    },
  }),
});
