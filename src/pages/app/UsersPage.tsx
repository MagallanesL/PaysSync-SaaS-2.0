import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import type { AcademyRole } from "../../lib/types";

interface AcademyUser {
  id: string;
  email: string;
  role: AcademyRole;
  status: string;
}

export function UsersPage() {
  const { membership } = useAuth();
  const [users, setUsers] = useState<AcademyUser[]>([]);

  useEffect(() => {
    async function load() {
      if (!membership) return;
      const snap = await getDocs(collection(db, `academies/${membership.academyId}/users`));
      setUsers(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<AcademyUser, "id">) })));
    }
    void load();
  }, [membership]);

  return (
    <Panel title="Usuarios de academia">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-3 py-2">UID</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="px-3 py-3 text-muted">{user.id}</td>
                <td className="px-3 py-3">{user.email}</td>
                <td className="px-3 py-3 uppercase text-primary">{user.role}</td>
                <td className="px-3 py-3 uppercase text-muted">{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
