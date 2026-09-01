import { describe, expect, it } from "vitest";
import { prismaConnectionUrl } from "@/lib/db-url";

describe("prismaConnectionUrl", () => {
  it("prefers DIRECT_URL", () => {
    expect(
      prismaConnectionUrl(
        "postgresql://u:p@ep-x-pooler.c-6.eu-central-1.aws.neon.tech/neondb",
        "postgresql://u:p@ep-x.c-6.eu-central-1.aws.neon.tech/neondb",
      ),
    ).toBe("postgresql://u:p@ep-x.c-6.eu-central-1.aws.neon.tech/neondb");
  });

  it("rewrites a Neon pooler host to the compute endpoint", () => {
    const pooled =
      "postgresql://u:p@ep-purple-haze-b2csjchw-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    const direct = prismaConnectionUrl(pooled);
    expect(direct).toContain("ep-purple-haze-b2csjchw.c-6.eu-central-1.aws.neon.tech");
    expect(direct).not.toContain("-pooler.");
    expect(direct).toContain("sslmode=require");
  });

  it("leaves localhost unchanged", () => {
    const local = "postgresql://bzenith:bzenith@localhost:5432/bzenith";
    expect(prismaConnectionUrl(local)).toBe(local);
  });
});
