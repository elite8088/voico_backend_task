import math
import uuid
from typing import Optional

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.modules.calls.schema import Call, CallLabel, CallStatus

SORTABLE_COLUMNS = {
    "phone_number": Call.phone_number,
    "caller_name": Call.caller_name,
    "status": Call.status,
    "label": Call.label,
    "duration_seconds": Call.duration_seconds,
    "started_at": Call.started_at,
    "created_at": Call.created_at,
}


class CallRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, call_id: uuid.UUID) -> Optional[Call]:
        result = await self.session.exec(select(Call).where(Call.id == call_id))
        return result.first()

    async def list_calls(
        self,
        status: Optional[CallStatus],
        page: int,
        page_size: int,
        caller_name: Optional[str] = None,
        phone_number: Optional[str] = None,
        label: Optional[CallLabel] = None,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_dir: str = "desc",
    ) -> tuple[list[Call], int, int, dict[str, int]]:
        query = select(Call)
        count_query = select(func.count()).select_from(Call)

        conditions = []
        if status is not None:
            conditions.append(Call.status == status)
        if caller_name:
            conditions.append(Call.caller_name.ilike(f"%{caller_name}%"))  # type: ignore[attr-defined]
        if phone_number:
            normalized = phone_number.replace(" ", "")
            if normalized:
                conditions.append(
                    func.replace(Call.phone_number, " ", "").ilike(f"%{normalized}%")  # type: ignore[attr-defined]
                )
        if label is not None:
            conditions.append(Call.label == label)
        if min_duration is not None:
            conditions.append(Call.duration_seconds >= min_duration)
        if max_duration is not None:
            conditions.append(Call.duration_seconds <= max_duration)

        for condition in conditions:
            query = query.where(condition)
            count_query = count_query.where(condition)

        count_result = await self.session.exec(count_query)
        total = count_result.one()

        counts: dict[str, int] = {}
        for s in CallStatus:
            c = (
                await self.session.exec(
                    select(func.count()).select_from(Call).where(Call.status == s)
                )
            ).one()
            counts[s.value] = c

        sort_column = SORTABLE_COLUMNS.get(sort_by or "", Call.created_at)
        order_expr = sort_column.asc() if sort_dir == "asc" else sort_column.desc()

        offset = (page - 1) * page_size
        query = query.order_by(order_expr).offset(offset).limit(page_size)
        result = await self.session.exec(query)
        calls = list(result.all())

        total_pages = math.ceil(total / page_size) if total > 0 else 1
        return calls, total, total_pages, counts

    async def update(self, call: Call) -> Call:
        self.session.add(call)
        await self.session.flush()
        await self.session.refresh(call)
        return call
