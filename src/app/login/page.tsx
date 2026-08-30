import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { listStaffForLogin } from "@/services/users";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const staff = await listStaffForLogin();
  return <LoginScreen staff={staff} showDevHelp={process.env.NODE_ENV !== "production"} />;
}
