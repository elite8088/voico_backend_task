import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status

from app.modules.calls.ai import enrich_transcript
from app.modules.calls.repository import CallRepository
from app.modules.calls.schema import (
    CallCounts,
    CallLabel,
    CallResponse,
    CallStatus,
    PaginatedCallsResponse,
    WebhookCallPayload,
)

logger = logging.getLogger(__name__)


class CallService:
    def __init__(self, repository: CallRepository) -> None:
        self.repository = repository

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
    ) -> PaginatedCallsResponse:
        calls, total, total_pages, counts = await self.repository.list_calls(
            status,
            page,
            page_size,
            caller_name=caller_name,
            phone_number=phone_number,
            label=label,
            min_duration=min_duration,
            max_duration=max_duration,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return PaginatedCallsResponse(
            data=[CallResponse.model_validate(c, from_attributes=True) for c in calls],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            counts=CallCounts(
                in_progress=counts.get("in_progress", 0),
                success=counts.get("success", 0),
                failed=counts.get("failed", 0),
            ),
        )

    async def get_call(self, call_id: uuid.UUID) -> CallResponse:
        call = await self.repository.get_by_id(call_id)
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        return CallResponse.model_validate(call, from_attributes=True)

    async def update_notes(self, call_id: uuid.UUID, notes: Optional[str]) -> CallResponse:
        call = await self.repository.get_by_id(call_id)
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        call.notes = notes
        call.updated_at = datetime.utcnow()
        updated = await self.repository.update(call)
        return CallResponse.model_validate(updated, from_attributes=True)

    async def process_webhook(self, payload: WebhookCallPayload) -> CallResponse:
        call = await self.repository.get_by_id(payload.call_id)
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

        call.status = payload.status
        if payload.duration_seconds is not None:
            call.duration_seconds = payload.duration_seconds
        if payload.raw_transcript is not None:
            call.raw_transcript = payload.raw_transcript
        if payload.ended_at is not None:
            call.ended_at = payload.ended_at
        call.updated_at = datetime.utcnow()

        if (
            payload.status in (CallStatus.success, CallStatus.failed)
            and payload.raw_transcript
        ):
            summary, label = await enrich_transcript(payload.raw_transcript)
            if summary is not None:
                call.summary = summary
            if label is not None:
                call.label = label

        updated = await self.repository.update(call)
        return CallResponse.model_validate(updated, from_attributes=True)
