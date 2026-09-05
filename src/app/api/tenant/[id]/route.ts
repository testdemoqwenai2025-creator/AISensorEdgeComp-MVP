import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// =====================================================================
// GET /api/tenant/[id] — get tenant status + details
// =====================================================================
// Returns: { tenantId, name, email, organization, vertical, sensorCount,
//            status, trialExpiresAt, apiEndpoint, dashboardUrl, sensorReadings, auditLog }
//
// Synthetic backend — returns data from SQLite. When production backend
// is ready, swap this route for a call to the real tenant service.
// =====================================================================

export async function GET(
  request: Request,
  { params }: Promise<{ params: { id: string } }> & { params: { id: string } }
) {
  try {
    const { id: tenantId } = await Promise.resolve(params).then(p => p || { id: '' });

    const tenant = await db.tenant.findUnique({
      where: { tenantId },
      include: {
        sensorReadings: { take: 20, orderBy: { timestamp: "desc" } },
        auditLog: { take: 10, orderBy: { timestamp: "desc" } },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check if trial has expired
    const now = new Date();
    const expired = now > tenant.trialExpiresAt;
    if (expired && tenant.status === "active") {
      await db.tenant.update({
        where: { tenantId },
        data: { status: "expired" },
      });
      tenant.status = "expired";
    }

    return NextResponse.json({
      ok: true,
      tenantId: tenant.tenantId,
      name: tenant.name,
      email: tenant.email,
      organization: tenant.organization,
      role: tenant.role,
      vertical: tenant.vertical,
      sensorCount: tenant.sensorCount,
      sensorTypes: JSON.parse(tenant.sensorTypes),
      status: tenant.status,
      apiKey: tenant.apiKey,
      apiEndpoint: tenant.apiEndpoint,
      dashboardUrl: tenant.dashboardUrl,
      trialExpiresAt: tenant.trialExpiresAt.toISOString(),
      createdAt: tenant.createdAt.toISOString(),
      daysRemaining: Math.max(0, Math.ceil(
        (tenant.trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )),
      sensorReadings: tenant.sensorReadings.map(r => ({
        sensorId: r.sensorId,
        value: r.value,
        unit: r.unit,
        status: r.status,
        timestamp: r.timestamp.toISOString(),
      })),
      auditLog: tenant.auditLog.map(a => ({
        action: a.action,
        details: a.details,
        timestamp: a.timestamp.toISOString(),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
