import { NextResponse } from "next/server";
import { isSerializationFailure } from "@/lib/idempotency";
import { HospitalityError } from "@/lib/hospitality-service";
import { StockError } from "@/lib/location-stock";
import { ApprovalError } from "@/lib/manager-approval";

export function hospitalityResponse(error: unknown, fallback: string) {
  if (error instanceof ApprovalError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof HospitalityError) {
    const status = error.code === "CONFLICT" ? 409 : error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof StockError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (isSerializationFailure(error)) {
    return NextResponse.json({ error: "Please retry this action." }, { status: 409 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
