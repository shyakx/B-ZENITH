import { assertProductionAuthSecret } from "@/lib/env";

export function register() {
  assertProductionAuthSecret();
}
