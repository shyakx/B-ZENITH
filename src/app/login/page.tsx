import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { listStaffForLogin } from "@/services/users";

export default async function LoginPage() {
  const [user, staff] = await Promise.all([getCurrentUser(), listStaffForLogin()]);
  return (
    <LoginScreen
      staff={staff}
      currentUser={user}
      showDevHelp={process.env.NODE_ENV !== "production"}
    />
  );
}
