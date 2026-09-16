import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmployeeId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const employeeId = normalizeEmployeeId(String(body.employee_id ?? ""));
  const password = String(body.password ?? "");
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;
  const dateOfBirth = String(body.date_of_birth ?? "") || null;
  const address = String(body.address ?? "").trim() || null;
  const position = String(body.position ?? "").trim() || null;
  const department = String(body.department ?? "").trim() || null;
  const profilePicturePath = String(body.profile_picture_path ?? "") || null;
  const documents: {
    name: string;
    category: string;
    file_name: string;
    file_path: string;
    size_bytes?: number | null;
    mime_type?: string | null;
  }[] = Array.isArray(body.documents) ? body.documents : [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!employeeId || !firstName || !lastName) {
    return NextResponse.json(
      { error: "Employee ID, first name and last name are required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (email && !emailRegex.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const db = await createClient();
  if (!db) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  // 1. The ID must have been pre-registered by the HR manager.
  const { data: idRecord, error: idError } = await db
    .from("employee_ids")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (idError || !idRecord) {
    return NextResponse.json(
      { error: "This employee ID is not in the system. Ask your HR manager to register your ID first." },
      { status: 400 }
    );
  }

  if (idRecord.status === "claimed") {
    const { data: existing } = await db
      .from("app_users")
      .select("status")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") {
        return NextResponse.json(
          { error: "This employee ID already has a registration awaiting HR verification." },
          { status: 409 }
        );
      }
      if (existing.status === "verified") {
        return NextResponse.json(
          { error: "This employee ID is already registered to an account." },
          { status: 409 }
        );
      }
      if (existing.status === "rejected") {
        return NextResponse.json(
          { error: "This employee ID was previously rejected. Ask your HR manager to reissue it." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { error: "This employee ID is already claimed." },
      { status: 409 }
    );
  }

  // 2. Create the account as pending – the employee only gets access
  //    after the HR manager reviews and verifies it.
  const passwordHash = await bcrypt.hash(password, 10);
  const { data: newUser, error: userError } = await db
    .from("app_users")
    .insert({
      employee_id: employeeId,
      password_hash: passwordHash,
      role: "employee",
      status: "pending",
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      date_of_birth: dateOfBirth,
      address,
      department: department ?? idRecord.department,
      position: position ?? idRecord.position,
      profile_picture_path: profilePicturePath,
    })
    .select("id")
    .single();

  if (userError) {
    // Unique violation – another registration slipped in first.
    if ((userError as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "This employee ID is already registered." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  // 3. Attach the uploaded document metadata.
  const docRows = documents
    .filter((d) => d.name && d.file_name && d.file_path)
    .map((d) => ({
      user_id: newUser.id,
      name: d.name,
      category: d.category,
      file_name: d.file_name,
      file_path: d.file_path,
      size_bytes: d.size_bytes ?? null,
      mime_type: d.mime_type ?? null,
    }));
  if (docRows.length > 0) {
    const { error: docError } = await db.from("documents").insert(docRows);
    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }
  }

  // 4. Mark the ID as claimed.
  await db
    .from("employee_ids")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("employee_id", employeeId);

  return NextResponse.json({
    ok: true,
    message:
      "Your registration has been submitted. An HR manager will review your details and verify your account.",
  });
}