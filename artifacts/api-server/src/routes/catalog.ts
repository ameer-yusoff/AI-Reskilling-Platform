import { Router, type IRouter } from "express";
import { ListRolesQueryParams, GetRoleParams, ListCoursesQueryParams } from "@workspace/api-zod";
import { loadCourses, loadRoles, courseToApi, roleToApi } from "../lib/catalog";
import { SDG_TARGETS } from "../data/courses";

const router: IRouter = Router();

router.get("/roles", async (req, res) => {
  const q = ListRolesQueryParams.parse(req.query);
  const roles = await loadRoles();
  res.json(roles.filter((r) => !q.sector || r.sector === q.sector).map(roleToApi));
});

router.get("/roles/:id", async (req, res) => {
  const { id } = GetRoleParams.parse(req.params);
  const role = (await loadRoles()).find((r) => r.id === id);
  if (!role) {
    res.status(404).json({ error: "Peranan tidak dijumpai" });
    return;
  }
  res.json(roleToApi(role));
});

router.get("/courses", async (req, res) => {
  const q = ListCoursesQueryParams.parse(req.query);
  const courses = await loadCourses();
  res.json(
    courses
      .filter((c) => !q.costType || c.costType === q.costType)
      .filter((c) => !q.hrdcOnly || c.hrdcStatus !== "not_claimable")
      .map(courseToApi),
  );
});

router.get("/sdg/targets", (_req, res) => {
  res.json(SDG_TARGETS);
});

export default router;
