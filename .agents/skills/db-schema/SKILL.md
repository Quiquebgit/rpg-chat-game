# Skill: db-schema

Referencia del esquema de base de datos del proyecto RPG Chat Game (Supabase/PostgreSQL).
Leer antes de tocar la BD, escribir migraciones o modificar hooks de Supabase.

---

## Tablas actuales (`public`)

| Tabla | Filas aprox. | RLS |
|---|---|---|
| `sessions` | ~26 | ✅ habilitado |
| `messages` | ~790 | ✅ habilitado |
| `session_character_state` | ~156 | ✅ habilitado |
| `items` | ~92 | ✅ habilitado |
| `enemies` | ~51 | ✅ habilitado |
| `difficulty_templates` | ~3 | ✅ habilitado |

---

## Políticas RLS actuales

La app **no tiene auth/login** — todos los jugadores usan el rol `anon`.
Todas las tablas tienen una política permisiva `FOR ALL TO anon USING (true)`.

> Cuando se añada autenticación, reemplazar estas políticas por otras restrictivas
> basadas en `auth.uid()` o roles de usuario.

---

## Regla obligatoria: RLS en tablas nuevas

**Toda tabla nueva en `public` debe llevar RLS habilitado + política explícita.**
Sin esto, Supabase lo marca como vulnerabilidad crítica y envía alertas de seguridad.

Plantilla para nuevas tablas sin auth:

```sql
ALTER TABLE public.<nueva_tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_<nueva_tabla>"
  ON public.<nueva_tabla>
  FOR ALL TO anon
  USING (true) WITH CHECK (true);
```

Plantilla cuando haya auth (futuro):

```sql
ALTER TABLE public.<nueva_tabla> ENABLE ROW LEVEL SECURITY;
-- Solo el propietario puede leer/escribir sus propias filas
CREATE POLICY "owner_only_<nueva_tabla>"
  ON public.<nueva_tabla>
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## Regla obligatoria: search_path en funciones

Las funciones PL/pgSQL deben fijar `search_path` para evitar inyección de esquema:

```sql
CREATE OR REPLACE FUNCTION public.mi_funcion()
  RETURNS ... LANGUAGE plpgsql
  SET search_path = public  -- <-- obligatorio
AS $$ ... $$;
```

---

## Esquema de columnas principales

### `sessions`
- `id` uuid PK
- `status` text — `active | finished | abandoned`
- `game_mode` text — `normal | combat | navigation | exploration | negotiation`
- `game_mode_data` jsonb — estado del modo activo (enemigos, pistas, NPCs...)
- `current_turn_character_id` text
- `turn_order` text[]
- `narrative_summary` text
- `story_file` text
- `difficulty_template_id` uuid → `difficulty_templates.id`
- `current_event_order` int
- `current_event_briefing` text
- `story_lore` text
- `updated_at` timestamptz — actualizado por trigger `update_session_updated_at`

### `messages`
- `id` uuid PK
- `session_id` uuid → `sessions.id`
- `character_id` text
- `content` text
- `type` text — `player | narrator | dice | action | gm`
- `created_at` timestamptz

### `session_character_state`
- `id` uuid PK
- `session_id` uuid → `sessions.id`
- `character_id` text
- `hp_current` int
- `inventory` jsonb `[]`
- `claimed_by` text (playerId del jugador)
- `is_active` boolean
- `is_dead` boolean
- `stunned` boolean

### `items`
- `id` uuid PK
- `name` text (unique)
- `type` text — `fruta | arma | equipo | consumible`
- `rarity` text — `común | raro | único`
- `is_negative` boolean
- `effects` jsonb `[]` — `[{ stat, modifier }]`
- `special_ability` text
- `equippable` boolean
- `target` text — `self | ally | any`
- `cure_difficulty` text — `easy | normal | hard`
- `immune_to` jsonb `[]` — tipos de ataque que el portador ignora (frutas): `["physical","slash",...]`
- `special_effect` jsonb — efecto especial activable en combate: `{ type: "aoe_attack|blind|..." }`

### `enemies`
- `id` uuid PK
- `name` text (unique)
- `type` text
- `hp`, `attack`, `defense` int
- `loot_table` jsonb
- `loot_type` text — `cualquiera | arma | equipo | consumible`
- `ability` jsonb

### `difficulty_templates`
- `id` uuid PK
- `name` text (unique)
- `description` text
- `event_count` int
- `events` jsonb

---

## Trigger

`update_session_updated_at` — actualiza `sessions.updated_at = now()` en cada UPDATE.
Función con `SET search_path = public`.
