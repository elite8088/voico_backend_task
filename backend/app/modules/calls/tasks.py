"""Background tasks for the calls module."""

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import update

from app.core.config import settings
from app.core.db import async_session
from app.modules.calls.schema import Call, CallStatus

logger = logging.getLogger(__name__)


async def expire_stale_calls() -> int:
    threshold = datetime.utcnow() - timedelta(minutes=settings.stale_threshold_minutes)

    async with async_session() as session:
        result = await session.execute(
            update(Call)
            .where(Call.status == CallStatus.in_progress)
            .where(Call.started_at < threshold)
            .values(status=CallStatus.failed, updated_at=datetime.utcnow())
        )
        await session.commit()
        return result.rowcount or 0


async def stale_calls_loop() -> None:
    interval_seconds = settings.stale_check_interval_minutes * 60
    logger.info(
        "Stale-call auto-expiry started (interval=%s min, threshold=%s min)",
        settings.stale_check_interval_minutes,
        settings.stale_threshold_minutes,
    )

    while True:
        try:
            expired = await expire_stale_calls()
            logger.info("Stale-call check complete: %s call(s) expired to failed", expired)
        except asyncio.CancelledError:
            logger.info("Stale-call auto-expiry stopped")
            raise
        except Exception:
            logger.exception("Stale-call check failed; will retry next interval")

        await asyncio.sleep(interval_seconds)
