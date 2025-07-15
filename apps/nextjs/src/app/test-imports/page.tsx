import { UserStatusCard } from "@acme/ui-desktop";
import { Button, mockSessionUsers } from "@acme/ui-shared";

export default function TestImports() {
  return (
    <div>
      <h1>Testing imports</h1>
      <p>UserStatusCard: {typeof UserStatusCard}</p>
      <p>Button: {typeof Button}</p>
      <p>mockSessionUsers: {typeof mockSessionUsers}</p>
    </div>
  );
}