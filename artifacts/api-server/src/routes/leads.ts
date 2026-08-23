import { Router, type Request, type Response } from "express";
import { db, leadsTable, type Lead } from "@workspace/db";
import { desc, eq, and, or, ilike, sql, count } from "drizzle-orm";
import { requireAdmin } from "./admin";

const router = Router();

// Helper to ensure table existence & seed default production/test leads if empty
export async function ensureLeadsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        interest TEXT,
        message TEXT,
        source TEXT DEFAULT 'website',
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const [row] = await db.select({ c: count() }).from(leadsTable);
    if ((row?.c ?? 0) === 0) {
      await db.insert(leadsTable).values([
        {
          name: "أحمد بن محمد العتيبي",
          email: "ahmed.otaibi@example.com",
          phone: "+966 50 123 4567",
          interest: "pro_plan",
          message: "استفسار حول الاشتراك السنوي في باقة الطيبات المتقدمة وإمكانية إضافة أفراد العائلة.",
          source: "website",
          status: "new",
          createdAt: new Date(Date.now() - 2 * 3600 * 1000),
        },
        {
          name: "سارة عبد الله الشمري",
          email: "sara.shammari@example.com",
          phone: "+966 55 987 6543",
          interest: "general_inquiry",
          message: "هل يغطي التطبيق المنتجات الغذائية المستوردة من أوروپا والخليج العربي؟",
          source: "website",
          status: "new",
          createdAt: new Date(Date.now() - 24 * 3600 * 1000),
        },
        {
          name: "د. خالد السعيد",
          email: "khaled.alsaeed@example.com",
          phone: "+966 54 321 0987",
          interest: "enterprise",
          message: "نرغب بتوفير حسابات موحدة لعيادة التغذية لدينا للاستفادة من محرك فحص المنتجات.",
          source: "mobile_app",
          status: "contacted",
          createdAt: new Date(Date.now() - 48 * 3600 * 1000),
        },
        {
          name: "ريم علي السليمان",
          email: "reem.suleiman@example.com",
          phone: "+966 56 444 3322",
          interest: "free_plan",
          message: "شكراً لكم على التطبيق الرائع، أتمنى إضافة خاصية تنبيه الحساسية المخصصة.",
          source: "landing_page",
          status: "closed",
          createdAt: new Date(Date.now() - 72 * 3600 * 1000),
        },
      ]);
    }
  } catch (err) {
    console.error("Failed to ensure leads table:", err);
  }
}

// ---------------------------------------------------------------------------
// 1. PUBLIC LEAD CREATION API: POST /api/leads
// ---------------------------------------------------------------------------
router.post("/api/leads", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, interest, message, source } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return void res.status(400).json({ error: "الاسم مطلوب" });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return void res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    const [inserted] = await db
      .insert(leadsTable)
      .values({
        name: cleanName,
        email: cleanEmail,
        phone: typeof phone === "string" ? phone.trim() : null,
        interest: typeof interest === "string" ? interest.trim() : "general_inquiry",
        message: typeof message === "string" ? message.trim() : null,
        source: typeof source === "string" ? source.trim() : "website",
        status: "new",
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "تم استلام طلبك بنجاح وسنقوم بالتواصل معك قريباً",
      lead: inserted,
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to create lead");
    res.status(500).json({ error: "تعذر حفظ طلب التواصل" });
  }
});

// ---------------------------------------------------------------------------
// 2. ADMIN GET LEADS API: GET /api/admin/leads
// ---------------------------------------------------------------------------
router.get("/api/admin/leads", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureLeadsTable();

    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);

    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const interestFilter = typeof req.query.interest === "string" ? req.query.interest.trim() : "";
    const searchQuery = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

    const conditions = [];

    if (statusFilter && statusFilter !== "all") {
      conditions.push(eq(leadsTable.status, statusFilter));
    }

    if (interestFilter && interestFilter !== "all") {
      conditions.push(eq(leadsTable.interest, interestFilter));
    }

    if (searchQuery) {
      conditions.push(
        or(
          ilike(leadsTable.name, `%${searchQuery}%`),
          ilike(leadsTable.email, `%${searchQuery}%`),
          ilike(leadsTable.phone, `%${searchQuery}%`),
          ilike(leadsTable.message, `%${searchQuery}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [allItems, newCountRow] = await Promise.all([
      db
        .select()
        .from(leadsTable)
        .where(whereClause)
        .orderBy(desc(leadsTable.createdAt)),
      db
        .select({ c: count() })
        .from(leadsTable)
        .where(eq(leadsTable.status, "new")),
    ]);

    const totalItems = allItems.length;
    const paginatedItems = allItems.slice(offset, offset + limit);

    res.json({
      items: paginatedItems,
      totalItems,
      newCount: newCountRow[0]?.c ?? 0,
      offset,
      limit,
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to get admin leads");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// 3. ADMIN UPDATE LEAD STATUS API: PATCH /api/admin/leads/:id
// ---------------------------------------------------------------------------
router.patch("/api/admin/leads/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id, 10);
    if (isNaN(leadId)) {
      return void res.status(400).json({ error: "معرّف الطلب غير صحيح" });
    }

    const { status } = req.body || {};

    const validStatuses = ["new", "contacted", "closed"];
    if (status && !validStatuses.includes(status)) {
      return void res.status(400).json({ error: "حالة الطلب غير صالحة" });
    }

    const updateFields: Partial<Lead> = {
      updatedAt: new Date(),
    };

    if (status) {
      updateFields.status = status;
    }

    const updatedRows = await db
      .update(leadsTable)
      .set(updateFields)
      .where(eq(leadsTable.id, leadId))
      .returning();

    if (updatedRows.length === 0) {
      return void res.status(404).json({ error: "طلب التواصل غير موجود" });
    }

    const [newCountRow] = await db
      .select({ c: count() })
      .from(leadsTable)
      .where(eq(leadsTable.status, "new"));

    res.json({
      success: true,
      item: updatedRows[0],
      newCount: newCountRow?.c ?? 0,
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to update lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
