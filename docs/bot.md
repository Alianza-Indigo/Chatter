# Bot inteligente

El bot (`apps/bot`) es un usuario Matrix que escucha por `/sync` con
`matrix-bot-sdk` y responde con un LLM configurable.

## Comportamiento

- Se loguea con `BOT_ACCESS_TOKEN` o `BOT_USER_ID` + `BOT_PASSWORD`.
- **Ignora sus propios mensajes** (anti-loop).
- Resuelve la **configuración por tenant/room**: extrae el `server_name` del
  `roomId` (`!abc:server`) y busca el tenant por `matrixServerName`; si no hay
  match, usa `BOT_DEFAULT_TENANT_SLUG` y, en último término, las variables de env.
  De cada tenant carga: `botSystemPrompt`, `botResponseMode`, proveedor LLM,
  `llmModel`, `llmBaseUrl` y `llmApiKey` (BYOK, **descifrada** en memoria).
- Responde según `botResponseMode` del tenant:
  - `dm` → solo en DMs con el bot.
  - `mention` (por defecto) → en DMs o cuando se le menciona.
  - `always` → a todos los mensajes del room (sigue ignorando los propios).
- Cachea proveedores LLM por firma de configuración y la config de tenant por
  room (TTL 60 s).
- **Limitación honesta (modo A, Synapse compartido):** si varios tenants comparten
  el mismo `server_name`, no se distinguen por `roomId` y se usa el tenant por
  defecto. Para multi-tenant estricto en un único homeserver haría falta un mapeo
  explícito room→tenant.
- Mantiene **contexto acotado** por room (últimos 12 mensajes en memoria; se
  pierde al reiniciar y no se comparte entre réplicas).
- Aplica **rate limit** por room (`BOT_RATE_LIMIT_PER_MINUTE`).
- Auto-acepta invitaciones (`AutojoinRoomsMixin`) para poder participar donde se le
  invita.

## Logs operativos

Cada evento registra: `tenantId`, `roomId`, `eventId`, `userId`, `timestamp`,
`status` y `error`. Estados: `received | ignored | processing | responded |
rate_limited | error`.

**El contenido del mensaje NO se guarda** salvo `BOT_STORE_CONTENT=true`. Los logs
van siempre a stdout y, si hay `DATABASE_URL`, también a la tabla `BotLog`
(consultable vía `GET /api/admin/bot/logs`).

## Proveedores LLM

Abstracción común:

```ts
interface LLMProvider {
  generateResponse(input: LLMInput): Promise<LLMOutput>;
}
```

Implementaciones (`apps/bot/src/llm/`):

| Proveedor | `LLM_PROVIDER` | Endpoint | Uso |
|-----------|----------------|----------|-----|
| OpenAI-compatible | `openai` | `${LLM_BASE_URL}/chat/completions` | OpenAI, Together, etc. (BYOK) |
| Ollama / vLLM | `ollama` | `${LLM_BASE_URL}/api/chat` | Local / self-hosted |
| Dummy | `dummy` | — | Desarrollo sin clave |

Configuración global por env (`LLM_*`) o por tenant (`llmProvider`, `llmModel`,
`llmBaseUrl`, y `llmApiKey` BYOK, que nunca se expone al frontend).

## Prompt del sistema

Prompt base (sobreescribible por tenant con `botSystemPrompt`):

> Eres el asistente interno de la organización. Responde con claridad, brevedad y
> utilidad. No inventes políticas internas. Si no sabes algo, dilo. No reveles
> información de otros rooms o usuarios.

## Privacidad

- El bot solo accede a rooms donde fue **invitado**.
- Solo procesa mensajes donde participa (DM o mención).
- La UI advierte que, al invitar al bot, este **puede leer los mensajes de ese room**.
- El proveedor LLM puede ser externo, BYOK o local; elige según los requisitos de
  privacidad del tenant. Para máxima privacidad, usar Ollama/vLLM local.

## Probar el bot sin Matrix

```bash
curl -X POST http://localhost:4000/api/admin/bot/test \
  -H 'content-type: application/json' \
  -H 'x-admin-token: <ADMIN_API_TOKEN>' \
  -d '{"prompt":"Hola, ¿qué eres?"}'
```
