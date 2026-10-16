-- Adds a unique, auto-generated, user-facing handle (5 lowercase-alphanumeric
-- characters) to User. Nullable at the DB level since it's assigned after
-- creation (see events.createUser in app/api/auth/[...nextauth]/route.ts),
-- but every user will have one in practice immediately after sign-in.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "handle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
