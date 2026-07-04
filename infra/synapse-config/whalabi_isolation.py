"""Módulo de aislamiento entre organizaciones para Synapse (Whalabi).

Refuerza, del lado del servidor, la regla del multitenant híbrido:
solo pueden invitarse/contactarse entre sí las personas que comparten
organización (o que ambas son "Globales"). Así, aunque alguien conozca el MXID
exacto de un usuario de otra organización, Synapse rechaza la invitación.

Cómo decide: consulta el endpoint interno de la API de Whalabi
(GET /api/internal/may-contact) autenticado con un secreto compartido. La API
resuelve la organización de cada usuario contra su índice de membresía.

Config en homeserver.yaml:

    modules:
      - module: whalabi_isolation.WhalabiIsolation
        config:
          api_url: "http://api:4000"
          secret: "<INTERNAL_API_SECRET>"
          exempt_users: "@whalabi-bot:whalabi.app,@admin:whalabi.app"
          fail_open: true

- exempt_users: MXIDs que siempre pueden contactar/ser contactados (bot, soporte).
- fail_open: si la API no responde, permitir (true) o bloquear (false) la invitación.
"""

import logging
from typing import Any

import treq
from synapse.module_api import NOT_SPAM, ModuleApi
from synapse.module_api.errors import Codes

logger = logging.getLogger(__name__)


class WhalabiIsolation:
    def __init__(self, config: dict, api: ModuleApi):
        self._api = api
        self._url = str(config.get("api_url", "http://api:4000")).rstrip("/")
        self._secret = str(config.get("secret", ""))
        self._fail_open = bool(config.get("fail_open", True))
        exempt = config.get("exempt_users", "") or ""
        self._exempt = {u.strip() for u in str(exempt).split(",") if u.strip()}

        api.register_spam_checker_callbacks(
            user_may_invite=self.user_may_invite,
        )
        logger.info(
            "WhalabiIsolation activo (api=%s, exentos=%d, fail_open=%s)",
            self._url,
            len(self._exempt),
            self._fail_open,
        )

    @staticmethod
    def parse_config(config: dict) -> dict:
        return config

    async def user_may_invite(self, inviter: str, invitee: str, room_id: str) -> Any:
        # El propio usuario y los exentos (bot, soporte) nunca se bloquean.
        if inviter == invitee or inviter in self._exempt or invitee in self._exempt:
            return NOT_SPAM
        allowed = await self._may_contact(inviter, invitee)
        return NOT_SPAM if allowed else Codes.FORBIDDEN

    async def _may_contact(self, a: str, b: str) -> bool:
        # Sin secreto configurado no forzamos el bloqueo (deja pasar).
        if not self._secret:
            return True
        try:
            resp = await treq.get(
                self._url + "/api/internal/may-contact",
                params={"from": a, "to": b},
                headers={b"x-internal-secret": self._secret.encode("utf-8")},
                timeout=5,
            )
            if resp.code != 200:
                logger.warning("may-contact respondió %s; fail_open=%s", resp.code, self._fail_open)
                return self._fail_open
            data = await resp.json()
            return bool(data.get("allow", self._fail_open))
        except Exception as exc:  # noqa: BLE001 — cualquier fallo de red cae a la política.
            logger.warning("may-contact falló (%s); fail_open=%s", exc, self._fail_open)
            return self._fail_open
