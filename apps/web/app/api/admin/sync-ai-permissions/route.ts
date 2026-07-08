import { requireSuperAdmin, json } from "@/lib/apiUtils";
import { ensureRoleDocuments, updateRolePermission } from "@/lib/rbacAdmin";
import { AI_AGENT_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const token = await requireSuperAdmin(req);
    if (!token) {
      return json({ ok: false, error: "Super admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action || "sync";

    if (action === "sync") {
      const roles = await ensureRoleDocuments(token.uid);
      let updated = 0;

      const ROLE_AI_PERMS: Record<string, readonly string[]> = {
        super_admin: AI_AGENT_PERMISSIONS,
        admin: ["ai_agent.view", "ai_agent.chat", "ai_agent.settings", "ai_agent.logs",
                "ai_agent.generate_notice", "ai_agent.generate_fee_message",
                "ai_agent.summarize_reports", "ai_agent.quota"],
        principal: ["ai_agent.view", "ai_agent.chat", "ai_agent.generate_notice",
                     "ai_agent.summarize_reports", "ai_agent.quota"],
        accountant: ["ai_agent.view", "ai_agent.chat", "ai_agent.generate_fee_message",
                      "ai_agent.summarize_reports", "ai_agent.quota"],
        settings_manager: ["ai_agent.view", "ai_agent.settings", "ai_agent.logs", "ai_agent.quota"],
        teacher: [],
        parent: [],
      };

      const db = adminDb();

      for (const [role, aiPerms] of Object.entries(ROLE_AI_PERMS)) {
        for (const permission of aiPerms) {
          await updateRolePermission({
            role: role as any,
            permission,
            allowed: true,
            changedBy: token.uid,
            changedByName: String(token.name || "System"),
          });
          updated++;
        }
      }

      return json({
        ok: true,
        message: `AI permissions synced for all roles. ${updated} permissions updated.`,
        updated,
      });
    }

    if (action === "status") {
      const db = adminDb();
      const roles = await ensureRoleDocuments(token.uid);
      const roleDetails = [];

      for (const roleObj of roles) {
        const doc = await db.collection("roles").doc(roleObj.slug).get();
        if (doc.exists) {
          const data = doc.data() as Record<string, unknown>;
          const perms = data.permissions as string[] || [];
          const hasAiPerms = AI_AGENT_PERMISSIONS.some((p) => perms.includes(p) || perms.includes("*"));
          const missingAiPerms = AI_AGENT_PERMISSIONS.filter((p) => !perms.includes(p) && !perms.includes("*"));
          roleDetails.push({
            role: roleObj.slug,
            totalPermissions: perms.length,
            hasWildcard: perms.includes("*"),
            hasAiPermissions: hasAiPerms,
            missingAiPermissions: missingAiPerms,
          });
        }
      }

      return json({ ok: true, roles: roleDetails });
    }

    return json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync permissions";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

