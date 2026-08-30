import { describe, expect, it } from "vitest";
import { canAccessPath, hasPermission, isPublicPath, isRole } from "@/lib/auth/roles";
import { isValidPin } from "@/lib/auth/pin";

describe("authentication and authorization", () => {
  it("accepts a 4-6 digit PIN and rejects a wrong shape", () => {
    expect(isValidPin("1111")).toBe(true);
    expect(isValidPin("12")).toBe(false);
    expect(isValidPin("abcdef")).toBe(false);
  });

  it("keeps each role on its own screens", () => {
    expect(canAccessPath("WAITER", "/waiter/orders/new")).toBe(true);
    expect(canAccessPath("WAITER", "/cashier/bills")).toBe(false);
    expect(canAccessPath("CASHIER", "/cashier/outstanding")).toBe(true);
    expect(canAccessPath("CASHIER", "/admin/users")).toBe(false);
    expect(canAccessPath("WAITER", "/manager/orders")).toBe(false);
    expect(canAccessPath("MANAGER", "/manager/orders")).toBe(true);
    expect(canAccessPath("MANAGER", "/manager/inventory")).toBe(true);
    expect(canAccessPath("MANAGER", "/admin/settings")).toBe(false);
    expect(canAccessPath("ADMIN", "/admin")).toBe(true);
    expect(canAccessPath("ADMIN", "/admin/audit")).toBe(true);
    expect(canAccessPath("ADMIN", "/admin/")).toBe(true);
    expect(canAccessPath("ADMIN", "/cashier/bills")).toBe(false);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("admin")).toBe(false);
  });

  it("blocks restricted operations by role", () => {
    expect(hasPermission("WAITER", "createOrder")).toBe(true);
    expect(hasPermission("WAITER", "recordPayment")).toBe(false);
    expect(hasPermission("CASHIER", "recordPayment")).toBe(true);
    expect(hasPermission("CASHIER", "payLater")).toBe(true);
    expect(hasPermission("CASHIER", "printFacture")).toBe(true);
    expect(hasPermission("CASHIER", "viewAllOrders")).toBe(true);
    expect(hasPermission("CASHIER", "createOrder")).toBe(false);
    expect(hasPermission("CASHIER", "manageProducts")).toBe(false);
    expect(hasPermission("CASHIER", "manageInventory")).toBe(false);
    expect(hasPermission("CASHIER", "manageUsers")).toBe(false);
    expect(hasPermission("CASHIER", "manageSettings")).toBe(false);
    expect(hasPermission("MANAGER", "viewAllOrders")).toBe(true);
    expect(hasPermission("MANAGER", "manageProducts")).toBe(true);
    expect(hasPermission("MANAGER", "manageInventory")).toBe(true);
    expect(hasPermission("MANAGER", "viewReports")).toBe(true);
    expect(hasPermission("MANAGER", "manageMaison")).toBe(true);
    expect(hasPermission("MANAGER", "recordPayment")).toBe(false);
    expect(hasPermission("MANAGER", "payLater")).toBe(false);
    expect(hasPermission("MANAGER", "createOrder")).toBe(false);
    expect(hasPermission("WAITER", "viewAllOrders")).toBe(false);
    expect(hasPermission("WAITER", "viewOwnOrders")).toBe(true);
    expect(hasPermission("ADMIN", "manageUsers")).toBe(true);
    expect(hasPermission("ADMIN", "manageSettings")).toBe(true);
    expect(hasPermission("ADMIN", "viewAudit")).toBe(true);
    expect(hasPermission("ADMIN", "recordPayment")).toBe(false);
    expect(hasPermission("WAITER", "manageUsers")).toBe(false);
    expect(hasPermission("WAITER", "manageSettings")).toBe(false);
    expect(hasPermission("CASHIER", "manageUsers")).toBe(false);
    expect(hasPermission("CASHIER", "manageSettings")).toBe(false);
    expect(hasPermission("MANAGER", "manageUsers")).toBe(false);
    expect(hasPermission("MANAGER", "manageSettings")).toBe(false);
    expect(hasPermission("MANAGER", "viewAudit")).toBe(false);
  });
});
