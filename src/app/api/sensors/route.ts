import { NextResponse } from "next/server";

// =====================================================================
// /api/sensors — simulated IoT sensor mesh
// ---------------------------------------------------------------------
// Returns the current state of a multi-modal sensor mesh. Values are
// generated deterministically from a sine + noise model so the same
// query returns reproducible-looking but evolving data. Includes
// intentional anomalies injected every ~30 calls for demo purposes.
// =====================================================================

interface SensorReading {
  id: string;
  name: string;
  modality: "vibration" | "temperature" | "pressure" | "gas" | "vision" | "soil";
  value: number;
  unit: string;
  status: "nominal" | "warning" | "critical" | "offline";
  sampleRateHz: number;
  edgeDevice: string;
  location: string;
  trend: "up" | "down" | "stable";
  confidence: number; // TS-FM model confidence in the reading
  inferredAt: "edge" | "cloud"; // where the inference ran
}

const SENSORS: Omit<SensorReading, "value" | "status" | "trend" | "confidence" | "inferredAt">[] = [
  { id: "vib_a3_l3", name: "Compressor A · Bearing 1 · Line 3", modality: "vibration", unit: "mm/s RMS", sampleRateHz: 10000, edgeDevice: "Hailo-8 · Bay 4", location: "Plant A · Building 3" },
  { id: "temp_a3_l3", name: "Compressor A · Outlet Temp · Line 3", modality: "temperature", unit: "°C", sampleRateHz: 1, edgeDevice: "Hailo-8 · Bay 4", location: "Plant A · Building 3" },
  { id: "press_a3_l3", name: "Compressor A · Outlet Pressure · Line 3", modality: "pressure", unit: "kPa", sampleRateHz: 1, edgeDevice: "Hailo-8 · Bay 4", location: "Plant A · Building 3" },
  { id: "gas_a3_l3", name: "Combustion Gas Sensor · Boiler 2", modality: "gas", unit: "ppm CO", sampleRateHz: 1, edgeDevice: "Coral · Boiler", location: "Plant A · Building 1" },
  { id: "vision_l4_qc", name: "Line 4 · QC Vision Camera", modality: "vision", unit: "defects/min", sampleRateHz: 30, edgeDevice: "Jetson Orin NX · Line 4", location: "Plant A · Building 2" },
  { id: "soil_field7_n", name: "Field 7 · Nitrogen · Soil Probe 12", modality: "soil", unit: "mg/kg", sampleRateHz: 0.001, edgeDevice: "RPi 5 · Field 7", location: "Agri Site · Field 7" },
  { id: "vib_b1_l2", name: "Motor B1 · Bearing · Line 2", modality: "vibration", unit: "mm/s RMS", sampleRateHz: 10000, edgeDevice: "Hailo-8 · Bay 2", location: "Plant A · Building 2" },
  { id: "temp_field7_air", name: "Field 7 · Air Temperature", modality: "temperature", unit: "°C", sampleRateHz: 0.016, edgeDevice: "RPi 5 · Field 7", location: "Agri Site · Field 7" },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const now = Date.now();

  // Generate readings with realistic patterns + occasional anomaly
  const callCounter = Math.floor(now / 1000); // changes every second
  const injectAnomaly = (callCounter % 30) === 0; // every ~30 seconds

  const readings: SensorReading[] = SENSORS.map((sensor, idx) => {
    // Sine wave + noise model
    const phase = (now / 1000 + idx * 0.5) * 0.3;
    const sine = Math.sin(phase);
    const noise = (Math.random() - 0.5) * 0.5;

    let value: number;
    let status: SensorReading["status"] = "nominal";
    let trend: SensorReading["trend"] = "stable";
    let confidence = 0.85 + Math.random() * 0.1;
    let inferredAt: SensorReading["inferredAt"] = "edge";

    // Per-modality baselines + ranges
    switch (sensor.modality) {
      case "vibration":
        value = 4.5 + sine * 1.2 + noise;
        if (injectAnomaly && idx === 0) {
          value = 11.2; // critical vibration
          status = "critical";
          trend = "up";
          confidence = 0.97;
          inferredAt = "edge";
        } else if (value > 8) {
          status = "warning";
          trend = "up";
        } else if (value > 6) {
          status = "warning";
          trend = "stable";
        }
        break;
      case "temperature":
        value = 72 + sine * 8 + noise * 2;
        if (value > 85) {
          status = "warning";
          trend = "up";
        } else if (value > 92) {
          status = "critical";
        }
        break;
      case "pressure":
        value = 182 + sine * 5 + noise;
        if (value > 195) {
          status = "warning";
          trend = "up";
        }
        break;
      case "gas":
        value = 12 + sine * 4 + noise;
        if (value > 22) {
          status = "warning";
          trend = "up";
        }
        break;
      case "vision":
        value = 0.8 + Math.abs(noise);
        if (value > 2) {
          status = "warning";
          trend = "up";
        }
        break;
      case "soil":
        value = 145 + sine * 30 + noise * 5;
        if (value < 80) {
          status = "warning";
          trend = "down";
        }
        break;
    }

    // Liquid placement: ~30% of heavy inferences run in cloud
    if (sensor.modality === "vision" || sensor.modality === "vibration") {
      if (Math.random() > 0.7) inferredAt = "cloud";
    }

    return { ...sensor, value: Number(value.toFixed(2)), status, trend, confidence: Number(confidence.toFixed(2)), inferredAt };
  });

  // Time-series window for charting (last 20 samples for each modality)
  const windowSize = 20;
  const series: Record<string, { t: number; v: number }[]> = {};
  SENSORS.forEach((sensor, idx) => {
    const arr: { t: number; v: number }[] = [];
    for (let i = windowSize - 1; i >= 0; i--) {
      const t = now - i * 2000; // 2s spacing
      const phase = (t / 1000 + idx * 0.5) * 0.3;
      const v = (sensor.modality === "vibration" ? 4.5 : sensor.modality === "temperature" ? 72 : sensor.modality === "pressure" ? 182 : sensor.modality === "gas" ? 12 : sensor.modality === "vision" ? 0.8 : 145) + Math.sin(phase) * (sensor.modality === "vibration" ? 1.2 : sensor.modality === "temperature" ? 8 : 5) + (Math.random() - 0.5) * 0.5;
      arr.push({ t, v: Number(v.toFixed(2)) });
    }
    series[sensor.id] = arr;
  });

  return NextResponse.json({
    timestamp: now,
    since,
    count: readings.length,
    readings,
    series,
    systemStats: {
      edgeDevices: 6,
      totalSensors: 8,
      nominalCount: readings.filter(r => r.status === "nominal").length,
      warningCount: readings.filter(r => r.status === "warning").length,
      criticalCount: readings.filter(r => r.status === "critical").length,
      offlineCount: readings.filter(r => r.status === "offline").length,
      inferenceEdge: readings.filter(r => r.inferredAt === "edge").length,
      inferenceCloud: readings.filter(r => r.inferredAt === "cloud").length,
      avgConfidence: Number((readings.reduce((s, r) => s + r.confidence, 0) / readings.length).toFixed(2)),
      dataRateKBps: 142 + Math.floor(Math.random() * 50),
      anomalyDetected: injectAnomaly,
    },
  });
}
