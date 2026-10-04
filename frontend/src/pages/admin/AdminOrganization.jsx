import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Building2, MapPinned, Plus, Workflow } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  SectionHeader,
  StatTile,
} from "../../components/ui";
import { CATEGORIES, CATEGORY_META } from "../../lib/labels";
import { Notice } from "./adminKit";
import { apiError } from "./adminUtils";

const byName = (a, b) => a.name.localeCompare(b.name);

export default function AdminOrganization() {
  const { can } = useAuth();
  const canManage = can("org:manage");

  const [departments, setDepartments] = useState([]);
  const [wards, setWards] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [departmentName, setDepartmentName] = useState("");
  const [wardName, setWardName] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [busy, setBusy] = useState(""); // "department" | "ward" | category key

  const fetchOrganization = useCallback(async () => {
    try {
      const [departmentRes, wardRes, rulesRes] = await Promise.all([
        api.get("/organization/departments"),
        api.get("/organization/wards"),
        api.get("/organization/rules"),
      ]);

      setDepartments([...(departmentRes.data.departments || [])].sort(byName));
      setWards([...(wardRes.data.wards || [])].sort(byName));
      setRules(rulesRes.data.rules || []);
      setError("");
    } catch (fetchError) {
      console.error("Fetch organization error:", fetchError);
      setError(apiError(fetchError, "Unable to load departments and wards."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // State is only set after the request resolves.
    async function load() {
      await fetchOrganization();
    }

    load();
  }, [fetchOrganization]);

  async function createDepartment(event) {
    event.preventDefault();

    const name = departmentName.trim();

    if (!name) {
      setNotice({ tone: "error", text: "Give the department a name." });
      return;
    }

    try {
      setBusy("department");
      setNotice(null);

      const response = await api.post("/organization/departments", { name });
      const created = response.data.department ?? { id: `new-${Date.now()}`, name };

      setDepartments((current) => [...current, created].sort(byName));
      setDepartmentName("");
      setNotice({
        tone: "success",
        text: response.data.message || `Added ${name}.`,
      });
    } catch (createError) {
      console.error("Create department error:", createError);
      setNotice({ tone: "error", text: apiError(createError, "Unable to add the department.") });
    } finally {
      setBusy("");
    }
  }

  async function createWard(event) {
    event.preventDefault();

    const name = wardName.trim();
    const code = wardCode.trim();

    if (!name || !code) {
      setNotice({ tone: "error", text: "A ward needs both a name and a code." });
      return;
    }

    try {
      setBusy("ward");
      setNotice(null);

      const response = await api.post("/organization/wards", { name, code });
      const created = response.data.ward ?? { id: `new-${Date.now()}`, name, code };

      setWards((current) => [...current, created].sort(byName));
      setWardName("");
      setWardCode("");
      setNotice({
        tone: "success",
        text: response.data.message || `Added ${name} (${code}).`,
      });
    } catch (createError) {
      console.error("Create ward error:", createError);
      setNotice({ tone: "error", text: apiError(createError, "Unable to add the ward.") });
    } finally {
      setBusy("");
    }
  }

  async function saveRule(category, departmentId) {
    try {
      setBusy(category);
      setNotice(null);

      await api.put("/organization/rules", {
        category,
        departmentId: departmentId || null,
      });

      const response = await api.get("/organization/rules");
      setRules(response.data.rules || []);

      const department = departments.find((item) => item.id === departmentId);

      setNotice({
        tone: "success",
        text: department
          ? `${CATEGORY_META[category].label} now routes to ${department.name}.`
          : `${CATEGORY_META[category].label} is no longer auto-routed.`,
      });
    } catch (ruleError) {
      console.error("Save rule error:", ruleError);
      setNotice({ tone: "error", text: apiError(ruleError, "Unable to save the rule.") });
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <Loading label={`Loading ${FEATURES.orgRouting}…`} />;
  }

  const ruleFor = (category) => rules.find((rule) => rule.category === category);
  const routedCount = CATEGORIES.filter(
    (category) => ruleFor(category)?.department?.id ?? ruleFor(category)?.departmentId
  ).length;
  const routesTo = (departmentId) =>
    CATEGORIES.filter(
      (category) =>
        (ruleFor(category)?.department?.id ?? ruleFor(category)?.departmentId) ===
        departmentId
    );

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.orgRouting}
        title="Departments, wards and routing"
        description="The map the city runs on: who owns which kind of problem, and where each ward starts and ends."
      />

      {error && <div className="form-error" role="alert">{error}</div>}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <section className="kpi-row" aria-label="Organisation at a glance">
        <StatTile
          label="Departments"
          value={departments.length}
          hint="own the fixes"
          icon={Building2}
          tone="navy"
        />
        <StatTile
          label="Wards"
          value={wards.length}
          hint="where reports come from"
          icon={MapPinned}
        />
        <StatTile
          label="Auto-routed categories"
          value={`${routedCount} of ${CATEGORIES.length}`}
          hint={
            routedCount === CATEGORIES.length
              ? "every category has a home"
              : "the rest wait for a manual assign"
          }
          icon={Workflow}
          tone={routedCount === CATEGORIES.length ? "success" : "warning"}
        />
      </section>

      <section className="card">
        <SectionHeader
          eyebrow="Routing"
          title="Where new cases go"
          description={`When ${FEATURES.autoSort} tags a report, it lands in the department you pick here. Leave it unrouted to assign by hand.`}
        />

        {departments.length === 0 ? (
          <EmptyState icon={Building2} title="No departments yet">
            Add a department below, then route categories to it.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table admin-table routing-table">
              <caption className="sr-only">Auto-routing rules by category</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">
                    <span className="sr-only">Routes to</span>
                  </th>
                  <th scope="col">Department</th>
                  <th scope="col">Mode</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((category) => {
                  const rule = ruleFor(category);
                  const departmentId = rule?.department?.id ?? rule?.departmentId ?? "";
                  const label = CATEGORY_META[category].label;

                  return (
                    <tr key={category}>
                      <th scope="row" className="routing-category">
                        <CategoryChip category={category} />
                      </th>
                      <td className="routing-arrow" aria-hidden="true">
                        <ArrowRight />
                      </td>
                      <td>
                        {canManage ? (
                          <select
                            className="routing-select"
                            value={departmentId}
                            aria-label={`Department for ${label}`}
                            disabled={busy === category}
                            onChange={(event) => saveRule(category, event.target.value)}
                          >
                            <option value="">No auto-routing</option>
                            {departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          rule?.department?.name ?? <span className="muted">Not routed</span>
                        )}
                      </td>
                      <td className="nowrap">
                        {busy === category ? (
                          <span className="chip">
                            <span className="spinner spinner-xs" aria-hidden="true" />
                            Saving…
                          </span>
                        ) : departmentId ? (
                          <span className="chip chip-success">Automatic</span>
                        ) : (
                          <span className="chip chip-outline">Manual</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid-2">
        <div className="card org-card">
          <SectionHeader
            eyebrow="Departments"
            title={`${departments.length} ${departments.length === 1 ? "department" : "departments"}`}
          />

          {canManage && (
            <form className="org-add" onSubmit={createDepartment}>
              <div className="field">
                <label htmlFor="department-name">New department</label>
                <input
                  id="department-name"
                  type="text"
                  value={departmentName}
                  onChange={(event) => setDepartmentName(event.target.value)}
                  placeholder="e.g. Parks & Gardens"
                  maxLength={80}
                />
              </div>
              <button
                type="submit"
                className="btn-secondary"
                disabled={busy === "department" || !departmentName.trim()}
              >
                <Plus aria-hidden="true" />
                {busy === "department" ? "Adding…" : "Add"}
              </button>
            </form>
          )}

          {departments.length === 0 ? (
            <p className="empty-inline">No departments yet.</p>
          ) : (
            <ul className="list-divided org-list">
              {departments.map((department) => {
                const routed = routesTo(department.id);

                return (
                  <li key={department.id}>
                    <span className="org-icon" aria-hidden="true">
                      <Building2 />
                    </span>
                    <span className="org-main">
                      <strong>{department.name}</strong>
                      <span className="org-routes">
                        {routed.length ? (
                          routed.map((category) => (
                            <CategoryChip key={category} category={category} short />
                          ))
                        ) : (
                          <span className="muted">No categories routed here</span>
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card org-card">
          <SectionHeader
            eyebrow="Wards"
            title={`${wards.length} ${wards.length === 1 ? "ward" : "wards"}`}
          />

          {canManage && (
            <form className="org-add org-add-ward" onSubmit={createWard}>
              <div className="field">
                <label htmlFor="ward-name">Ward name</label>
                <input
                  id="ward-name"
                  type="text"
                  value={wardName}
                  onChange={(event) => setWardName(event.target.value)}
                  placeholder="e.g. Civil Lines"
                  maxLength={80}
                />
              </div>
              <div className="field">
                <label htmlFor="ward-code">Code</label>
                <input
                  id="ward-code"
                  type="text"
                  value={wardCode}
                  onChange={(event) => setWardCode(event.target.value.toUpperCase())}
                  placeholder="W-30"
                  maxLength={12}
                />
              </div>
              <button
                type="submit"
                className="btn-secondary"
                disabled={busy === "ward" || !wardName.trim() || !wardCode.trim()}
              >
                <Plus aria-hidden="true" />
                {busy === "ward" ? "Adding…" : "Add"}
              </button>
            </form>
          )}

          {wards.length === 0 ? (
            <p className="empty-inline">No wards yet.</p>
          ) : (
            <ul className="ward-grid">
              {wards.map((ward) => (
                <li key={ward.id}>
                  <span className="ward-code mono">{ward.code}</span>
                  <span>{ward.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
