import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

const RULE_CATEGORIES = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

export default function AdminOrganization() {
  const [departments, setDepartments] = useState([]);
  const [wards, setWards] = useState([]);
  const [rules, setRules] = useState([]);

  const [departmentName, setDepartmentName] = useState("");
  const [wardName, setWardName] = useState("");
  const [wardCode, setWardCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchOrganizationData() {
    try {
      setError("");

      const [departmentResponse, wardResponse, rulesResponse] =
        await Promise.all([
          api.get("/organization/departments"),
          api.get("/organization/wards"),
          api.get("/organization/rules"),
        ]);

      setDepartments(
        departmentResponse.data.departments || []
      );

      setWards(
        wardResponse.data.wards || []
      );

      setRules(rulesResponse.data.rules || []);
    } catch (error) {
      console.error(
        "Fetch organization data error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Unable to load departments and wards."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  async function handleCreateDepartment(event) {
    event.preventDefault();

    if (!departmentName.trim()) {
      setError("Department name is required.");
      return;
    }

    try {
      setDepartmentLoading(true);
      setError("");
      setSuccess("");

      const response = await api.post(
        "/organization/departments",
        {
          name: departmentName.trim(),
        }
      );

      setDepartments((current) => [
        ...current,
        response.data.department,
      ].sort((a, b) =>
        a.name.localeCompare(b.name)
      ));

      setDepartmentName("");

      setSuccess(
        response.data.message ||
          "Department created successfully."
      );
    } catch (error) {
      console.error(
        "Create department error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Unable to create department."
      );
    } finally {
      setDepartmentLoading(false);
    }
  }

  async function handleCreateWard(event) {
    event.preventDefault();

    if (!wardName.trim()) {
      setError("Ward name is required.");
      return;
    }

    if (!wardCode.trim()) {
      setError("Ward code is required.");
      return;
    }

    try {
      setWardLoading(true);
      setError("");
      setSuccess("");

      const response = await api.post(
        "/organization/wards",
        {
          name: wardName.trim(),
          code: wardCode.trim(),
        }
      );

      setWards((current) => [
        ...current,
        response.data.ward,
      ].sort((a, b) =>
        a.name.localeCompare(b.name)
      ));

      setWardName("");
      setWardCode("");

      setSuccess(
        response.data.message ||
          "Ward created successfully."
      );
    } catch (error) {
      console.error(
        "Create ward error:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Unable to create ward."
      );
    } finally {
      setWardLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/admin">
            ‹ Back to Dashboard
          </Link>

          <h1>Departments & Wards</h1>

          <p>
            Manage the organizational structure
            used for civic issue assignments.
          </p>
        </div>

        <p>Loading organization data...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/admin">
          ‹ Back to Dashboard
        </Link>

        <p className="eyebrow">
          ORGANIZATION
        </p>

        <h1>Departments & Wards</h1>

        <p>
          Manage departments and wards used to
          organize and assign civic issues.
        </p>
      </div>

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {success && (
        <div className="form-success">
          {success}
        </div>
      )}

      {/* Create Department */}

      <section className="details-card">
        <p className="eyebrow">
          DEPARTMENTS
        </p>

        <h2>Add Department</h2>

        <form
          onSubmit={handleCreateDepartment}
          className="form"
        >
          <div className="form-group">
            <label htmlFor="departmentName">
              Department Name
            </label>

            <input
              id="departmentName"
              type="text"
              value={departmentName}
              onChange={(event) =>
                setDepartmentName(
                  event.target.value
                )
              }
              placeholder="e.g. Public Works"
            />
          </div>

          <button
            type="submit"
            disabled={departmentLoading}
          >
            {departmentLoading
              ? "Adding..."
              : "Add Department"}
          </button>
        </form>
      </section>

      {/* Department List */}

      <section className="details-card">
        <p className="eyebrow">
          EXISTING DEPARTMENTS
        </p>

        <h2>Departments</h2>

        {departments.length === 0 ? (
          <p>
            No departments have been created yet.
          </p>
        ) : (
          <div className="stats-list">
            {departments.map((department) => (
              <div
                className="stats-list-item"
                key={department.id}
              >
                <span>
                  {department.name}
                </span>

                <strong>
                  Department
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Ward */}

      <section className="details-card">
        <p className="eyebrow">
          WARDS
        </p>

        <h2>Add Ward</h2>

        <form
          onSubmit={handleCreateWard}
          className="form"
        >
          <div className="form-group">
            <label htmlFor="wardName">
              Ward Name
            </label>

            <input
              id="wardName"
              type="text"
              value={wardName}
              onChange={(event) =>
                setWardName(
                  event.target.value
                )
              }
              placeholder="e.g. Central Ward"
            />
          </div>

          <div className="form-group">
            <label htmlFor="wardCode">
              Ward Code
            </label>

            <input
              id="wardCode"
              type="text"
              value={wardCode}
              onChange={(event) =>
                setWardCode(
                  event.target.value
                )
              }
              placeholder="e.g. CW-01"
            />
          </div>

          <button
            type="submit"
            disabled={wardLoading}
          >
            {wardLoading
              ? "Adding..."
              : "Add Ward"}
          </button>
        </form>
      </section>

      {/* Ward List */}

      <section className="details-card">
        <p className="eyebrow">
          EXISTING WARDS
        </p>

        <h2>Wards</h2>

        {wards.length === 0 ? (
          <p>
            No wards have been created yet.
          </p>
        ) : (
          <div className="stats-list">
            {wards.map((ward) => (
              <div
                className="stats-list-item"
                key={ward.id}
              >
                <span>
                  {ward.name}
                </span>

                <strong>
                  {ward.code}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="details-card">
        <p className="eyebrow">AUTOMATION</p>

        <h2>Auto-assignment rules</h2>

        <p className="verification-intro">
          Map an issue category to a department and
          every new report in that category is routed
          there automatically.
        </p>

        {departments.length === 0 ? (
          <p>
            Create a department first, then set up
            rules.
          </p>
        ) : (
          <div className="rules-list">
            {RULE_CATEGORIES.map((category) => {
              const rule = rules.find(
                (rule) => rule.category === category
              );

              return (
                <div
                  className="stats-list-item"
                  key={category}
                >
                  <span>
                    {category
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (char) =>
                        char.toUpperCase()
                      )}
                  </span>

                  <select
                    className="rule-select"
                    value={
                      rule?.department?.id || ""
                    }
                    onChange={async (event) => {
                      try {
                        setError("");

                        await api.put(
                          "/organization/rules",
                          {
                            category,
                            departmentId:
                              event.target.value ||
                              null,
                          }
                        );

                        const response =
                          await api.get(
                            "/organization/rules"
                          );

                        setRules(
                          response.data.rules || []
                        );

                        setSuccess("Rule saved.");
                      } catch (error) {
                        setError(
                          error.response?.data
                            ?.message ||
                            "Unable to save the rule."
                        );
                      }
                    }}
                  >
                    <option value="">
                      No auto-routing
                    </option>
                    {departments.map(
                      (department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}