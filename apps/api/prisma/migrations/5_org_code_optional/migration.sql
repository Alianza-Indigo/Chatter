-- Organización "sin código" (general): el código pasa a ser opcional.
-- null = sus miembros van al espacio general/Global compartido.
ALTER TABLE "Organization" ALTER COLUMN "code" DROP NOT NULL;
