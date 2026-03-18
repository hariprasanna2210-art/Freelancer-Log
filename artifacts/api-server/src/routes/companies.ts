import { Router, type IRouter } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateCompanyBody, DeleteCompanyParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/companies", async (_req, res) => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.createdAt);
  const result = companies.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
  }));
  res.json(result);
});

router.post("/companies", async (req, res) => {
  const body = CreateCompanyBody.parse(req.body);
  const [company] = await db.insert(companiesTable).values({ name: body.name }).returning();
  res.status(201).json({
    id: company.id,
    name: company.name,
    createdAt: company.createdAt.toISOString(),
  });
});

router.delete("/companies/:id", async (req, res) => {
  const { id } = DeleteCompanyParams.parse({ id: req.params.id });
  await db.delete(companiesTable).where(eq(companiesTable.id, id));
  res.json({ success: true });
});

export default router;
