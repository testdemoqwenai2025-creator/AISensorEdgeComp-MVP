import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

// =====================================================================
// POST /api/provision — create a new sandbox tenant
// =====================================================================
// Accepts: { name, email, organization, role, sensorCount, sensorTypes, vertical }
// Returns: { tenantId, apiKey, apiEndpoint, dashboardUrl, trialExpiresAt, status }
//
// This is a synthetic backend — it provisions a real database record
// with a real API key and 60-day trial, but the "sandbox" is just a
// database entry. When production backend is ready, swap this route
// for a call to the real provisioning service.
// =====================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, organization, role, sensorCount, sensorTypes, vertical } = body;

    // Validate required fields
    if (!name || !email || !organization) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, organization" },
        { status: 400 }
      );
    }

    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const count = Math.min(50000, Math.max(100, parseInt(sensorCount) || 1000));
    const types = sensorTypes || ["vibration", "temperature", "pressure"];
    const vert = vertical || "manufacturing";

    // Generate tenant ID and API key
    const tenantId = `sbx_${randomBytes(6).toString("hex")}`;
    const apiKey = `sk_${randomBytes(16).toString("hex")}`;

    // Set 60-day trial expiry
    const trialExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Build API endpoint and dashboard URL (synthetic placeholders)
    const apiEndpoint = `https://staging-api.aisensoredgecomp.ai/${tenantId}`;
    const dashboardUrl = `https://sandbox.aisensoredgecomp.ai/${tenantId}`;

    // Create tenant in database
    const tenant = await db.tenant.create({
      data: {
        tenantId,
        name,
        email,
        organization,
        role: role || "VP Operations",
        sensorCount: count,
        sensorTypes: JSON.stringify(types),
        vertical: vert,
        status: "active",
        apiKey,
        apiEndpoint,
        dashboardUrl,
        trialExpiresAt,
      },
    });

    // Log the provisioning action
    await db.auditLog.create({
      data: {
        tenantId,
        action: "tenant_provisioned",
        details: `Provisioned ${count} synthetic sensors for ${vert} vertical`,
      },
    });

    // Generate initial synthetic sensor readings (10 sample sensors)
    const sensorConfigs = generateSensorConfigs(vert, types, count);
    for (const sensor of sensorConfigs.slice(0, 10)) {
      await db.sensorReading.create({
        data: {
          tenantId,
          sensorId: sensor.id,
          value: sensor.baseline + (Math.random() - 0.5) * sensor.variance,
          unit: sensor.unit,
          status: "nominal",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      tenantId,
      apiKey,
      apiEndpoint,
      dashboardUrl,
      sensorCount: count,
      vertical: vert,
      trialExpiresAt: trialExpiresAt.toISOString(),
      status: "active",
      note: "Synthetic backend — tenant provisioned in SQLite. Replace with production backend when ready.",
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    return NextResponse.json(
      { error: err?.message || "Provisioning failed" },
      { status: 500 }
    );
  }
}

// GET /api/provision — list all tenants (admin/debug)
export async function GET() {
  try {
    const tenants = await db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        tenantId: true,
        name: true,
        email: true,
        organization: true,
        vertical: true,
        sensorCount: true,
        status: true,
        trialExpiresAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ tenants, count: tenants.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// Helper: generate sensor configs based on vertical
function generateSensorConfigs(vertical: string, types: string[], count: number) {
  const configs: { id: string; baseline: number; variance: number; unit: string }[] = [];

  const baselines: Record<string, { baseline: number; variance: number; unit: string }> = {
    vibration: { baseline: 4.5, variance: 0.5, unit: "mm/s RMS" },
    temperature: { baseline: 72, variance: 5, unit: "°C" },
    pressure: { baseline: 182450, variance: 5000, unit: "Pa" },
    flow: { baseline: 450, variance: 20, unit: "m³/h" },
    gas: { baseline: 5, variance: 2, unit: "ppm" },
    level: { baseline: 65, variance: 5, unit: "%" },
    acoustic: { baseline: 45, variance: 5, unit: "dB" },
    corrosion: { baseline: 0.08, variance: 0.02, unit: "mm/yr" },
    "valve-position": { baseline: 75, variance: 2, unit: "% open" },
    power: { baseline: 285, variance: 10, unit: "A" },
    environmental: { baseline: 8.5, variance: 2, unit: "m/s" },
    flame: { baseline: 0, variance: 0, unit: "detected" },
  };

  for (const type of types) {
    const config = baselines[type] || { baseline: 50, variance: 5, unit: "units" };
    const sensorsPerType = Math.ceil(count / types.length);
    for (let i = 0; i < Math.min(3, sensorsPerType); i++) {
      configs.push({
        id: `${type}_${vertical}_${i + 1}`,
        baseline: config.baseline,
        variance: config.variance,
        unit: config.unit,
      });
    }
  }

  return configs;
}
