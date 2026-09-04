import { NextResponse } from "next/server";

// =====================================================================
// /api/login — mock authentication for the MVP dashboard
// ---------------------------------------------------------------------
// This is a demo login. Real auth (NextAuth.js + Prisma) will ship
// when the dashboard goes live for design partners.
// =====================================================================

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Mock: any valid email + 6+ char password succeeds. Generate a fake session token.
    const token = `demo_${Buffer.from(email).toString("base64url")}_${Date.now()}`;
    return NextResponse.json({
      ok: true,
      token,
      user: { email, name: email.split("@")[0], role: "design_partner" },
      note: "MVP demo auth — real auth (NextAuth.js + Prisma) ships at GA.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Login failed." }, { status: 500 });
  }
}
