import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL,
  SUPER_ADMIN_CRITICAL_PERMISSIONS,
  hasPermission,
  hasPermissionFromList,
  type Role
} from "./rbac";

describe("hasPermission", () => {
  it("denies undefined and unknown roles", () => {
    assert.equal(hasPermission(undefined, "dashboard.view"), false);
    assert.equal(hasPermission("ghost" as Role, "dashboard.view"), false);
  });

  it("settings_manager holds every permission via ALL", () => {
    assert.equal(hasPermission("settings_manager", "fees.create"), true);
    assert.equal(hasPermission("settings_manager", "dashboard.view"), true);
  });

  it("parent may use the portal but never fee write permissions", () => {
    assert.equal(hasPermission("parent", "portal.view"), true);
    assert.equal(hasPermission("parent", "fees.create"), false);
    assert.equal(hasPermission("parent", "fees.approve"), false);
    assert.equal(hasPermission("parent", "students.view"), false);
  });

  it("teacher has no fee or payroll-style write permissions", () => {
    assert.equal(hasPermission("teacher", "students.view"), true);
    assert.equal(hasPermission("teacher", "attendance.create"), true);
    assert.equal(hasPermission("teacher", "fees.create"), false);
    assert.equal(hasPermission("teacher", "fees.approve"), false);
  });

  it("accountant keeps finance permissions", () => {
    assert.equal(hasPermission("accountant", "fees.create"), true);
    assert.equal(hasPermission("accountant", "fees.approve"), true);
    assert.equal(hasPermission("accountant", "dashboard.view"), true);
  });
});

describe("hasPermissionFromList", () => {
  it("falls back to the static role matrix when no override list exists", () => {
    assert.equal(hasPermissionFromList("parent", undefined, "portal.view"), true);
    assert.equal(hasPermissionFromList("parent", undefined, "fees.create"), false);
  });

  it("honors a granted override for a permission the role lacks", () => {
    assert.equal(hasPermissionFromList("teacher", ["fees.view"], "fees.view"), true);
    assert.equal(hasPermissionFromList("teacher", ["fees.view"], "fees.create"), false);
  });

  it("ALL in an override list grants everything", () => {
    assert.equal(hasPermissionFromList("parent", [ALL], "fees.create"), true);
  });

  it("always grants super_admin critical permissions", () => {
    const critical = SUPER_ADMIN_CRITICAL_PERMISSIONS[0];
    assert.ok(critical, "expected at least one critical permission");
    assert.equal(hasPermissionFromList("super_admin", [], critical), true);
  });
});
