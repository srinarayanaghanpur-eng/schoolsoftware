class ErpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ErpError";
    this.code = code;
  }
}

class ErpClient {
  constructor({ getOrigin, getToken, fetchImpl = globalThis.fetch }) {
    this.getOrigin = getOrigin;
    this.getToken = getToken;
    this.fetchImpl = fetchImpl;
  }

  async request(pathWithQuery) {
    const origin = String(this.getOrigin() || "").replace(/\/$/, "");
    if (!origin) throw new ErpError("ERP_NOT_CONFIGURED", "ERP URL is not configured");

    const token = String(this.getToken() || "");
    if (!token) {
      throw new ErpError(
        "ERP_NOT_CONNECTED",
        "ERP session token not captured yet. Sign in to the ERP, open Dashboard, then reopen this agent."
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await this.fetchImpl(`${origin}${pathWithQuery}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });

      const text = await response.text();
      let payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }

      if (response.status === 401 || response.status === 403) {
        throw new ErpError("ERP_AUTH", "ERP login expired or this account lacks permission.");
      }
      if (!response.ok) {
        throw new ErpError(
          "ERP_REQUEST_FAILED",
          payload.error || payload.message || `ERP returned HTTP ${response.status}`
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof ErpError) throw error;
      if (error?.name === "AbortError") throw new ErpError("ERP_TIMEOUT", "ERP request timed out");
      throw new ErpError("ERP_REQUEST_FAILED", error instanceof Error ? error.message : "ERP request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  async academicYears() {
    const result = await this.request("/api/admin/academic-years");
    if (!result?.ok || !Array.isArray(result.years)) {
      throw new ErpError("ERP_BAD_RESPONSE", "Could not load academic years from ERP");
    }
    return result.years.map((year) => ({
      id: String(year.id || ""),
      name: String(year.name || year.yearName || year.id || ""),
      isActive: Boolean(year.isActive)
    }));
  }

  async students(filters = {}) {
    const max = Math.max(1, Math.min(Number(filters.max || 500), 500));
    const pageSize = 100;
    const dueOnly = Boolean(filters.dueOnly);
    const seen = new Set();
    const students = [];
    let cursor = "";

    for (;;) {
      if (students.length >= max) break;
      const params = new URLSearchParams();
      params.set("status", "active");
      params.set("pageSize", String(pageSize));
      if (filters.academicYearId) params.set("academicYearId", String(filters.academicYearId));
      if (filters.className) params.set("class", String(filters.className));
      if (filters.section) params.set("section", String(filters.section));
      if (filters.q) params.set("q", String(filters.q));
      if (cursor) params.set("cursor", cursor);

      const result = await this.request(`/api/admin/students?${params.toString()}`);
      if (!result?.success || !Array.isArray(result.data)) {
        throw new ErpError("ERP_BAD_RESPONSE", result?.error || "Could not load students from ERP");
      }

      for (const student of result.data) {
        const id = String(student.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (dueOnly && Number(student.totalFeesDue ?? student.totalDue ?? 0) <= 0) continue;
        students.push(student);
        if (students.length >= max) break;
      }

      cursor = String(result.nextCursor || "");
      if (!cursor || !result.hasMore) break;
    }

    return {
      students,
      truncated: students.length >= max
    };
  }
}

module.exports = { ErpClient, ErpError };
