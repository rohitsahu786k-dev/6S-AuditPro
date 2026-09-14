import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { fail } from "@/utils/api";

export async function GET(request: Request) {
  try {
    assertCronAuthorized(request);
  } catch (error) {
    return fail(error);
  }
  try {
    const mongoose = await connectDB();
    await mongoose.connection.db!.command({ ping: 1 }, { timeoutMS: 5000 });
    return NextResponse.json({ status: "healthy", database: "reachable" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unhealthy", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
