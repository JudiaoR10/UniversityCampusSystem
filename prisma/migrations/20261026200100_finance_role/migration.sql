-- A utilização do novo valor do enum ocorre depois da migração que o adicionou.
INSERT INTO "Role" ("id", "code", "name", "description", "createdAt", "updatedAt")
VALUES ('role_finance', 'FINANCE', 'Tesouraria', 'Gestão financeira de estudantes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
