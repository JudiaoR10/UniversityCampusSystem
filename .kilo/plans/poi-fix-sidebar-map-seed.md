# Plano: merge upstream/main na branch e criar PR para UniversityCampusSystem

## Contexto
- Branch atual: `feature/grupo-gestao-campus-upstream` em `d0deff8`
- Upstream (`acorreialabs/UniversityCampusSystem`): `main` em `8973717` (moved from `46e8000` desde o último fetch)
- O upstream alterou 45 ficheiros entre `46e8000` e `8973717`, incluindo 5 ficheiros que o utilizador também modificou

## Ficheiros com overlap (potencial conflito)

| Ficheiro | Alteração do utilizador | Alteração do upstream | Estratégia de resolução |
|---|---|---|---|
| `apps/api/src/app.ts` | +poiRouter import/route | rateLimit → configureRateLimits | Manter ambas as alterações (secções diferentes) |
| `apps/api/src/modules/dashboard/application/dashboardService.ts` | +actorRole, room filter por temPlaca | +canSeeAlerts (filtrar alerts para STUDENT) | Combinar: adicionar actorRole E manter canSeeAlerts |
| `apps/web/src/layouts/AppLayout.tsx` | +pois in navGroups | useNotifications connectionState | Manter ambas (secções diferentes) |
| `packages/shared-types/src/index.ts` | +POIDto, temPlaca, sala_codigo, POI module | ScheduleFilters, AttendanceRoster, campusModules format | Manter ambas (secções diferentes) |
| `packages/validation/src/index.ts` | +temPlaca, sala_codigo, POI schemas | upsertGrades, updateSchedule, markAttendance refinements | Manter ambas (secções diferentes) |

## Passos de execução

### Fase 1 — Fetch e merge
1. `git fetch upstream` — trazer as alterações mais recentes do docente
2. `git merge upstream/main` — iniciar o merge
3. Resolver conflitos (especialmente `dashboardService.ts`)

### Fase 2 — Resolver conflito em dashboardService.ts
Combinar ambas as alterações:
```typescript
export async function getDashboard(userId: string, actorRole?: string) {
  const isAdmin = actorRole === 'ADMIN';
  const roomFilter = isAdmin ? {} : { temPlaca: true };
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { code: true } } },
  });
  const canSeeAlerts = viewer?.role.code !== 'STUDENT';

  const [currentUser, roomsCount, openIncidents, devicesCount, recentAlerts, recentActivity, core] = await Promise.all([
    getMe(userId),
    prisma.room.count({ where: roomFilter }),
    prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.device.count(),
    canSeeAlerts
      ? prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
      : Promise.resolve([]),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    getAdminStatus(),
  ]);
  // ... rest unchanged
}
```

### Fase 3 — Resolver conflitos nos outros ficheiros
- `app.ts`: manter import de `poiRouter` + `configureRateLimits` do upstream
- `AppLayout.tsx`: manter `pois` in navGroups + `connectionState` do upstream
- `shared-types`: manter POIDto/temPlaca/sala_codigo/POI + alterações upstream (ScheduleFilters, AttendanceRoster)
- `validation`: manter temPlaca/sala_codigo/POI schemas + refinements upstream

### Fase 4 — Validar
4. `npx prisma validate` — confirmar schema válido
5. `npx prisma generate` — regenerar cliente
6. `npm run build` — compilar tudo
7. `npm run dev` — testar localmente

### Fase 5 — Criar PR
8. `git push origin feature/grupo-gestao-campus-upstream` — push da branch
9. `gh pr create --base main --head feature/grupo-gestao-campus-upstream --repo acorreialabs/UniversityCampusSystem` — criar PR
   - Title: "feat(infra): adicionar POI, tabela placas, temPlaca, sala em Laboratory, regras de negócio"
   - Body: resumo das alterações

## Rollback
- Se o merge falhar: `git merge --abort`
- Se já commitar: `git reset --hard ORIG_HEAD`

## Observações
- O upstream não adicionou novas migrations, pelo que não há conflito de migration filenames
- O upstream não adicionou ficheiros que conflitam com os novos ficheiros do utilizador (poi/, seeds, migrations)
- A resolução do conflito em dashboardService.ts é a única que requer intervenção manual
- Após o merge, o utilizador deve testar localmente antes de criar o PR