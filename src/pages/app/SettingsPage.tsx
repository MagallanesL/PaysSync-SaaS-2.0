import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";

interface AcademySettings {
  name: string;
  slug: string;
  plan: string;
  status: string;
  planLimits?: {
    maxStudents: number | null;
  };
}

export function SettingsPage() {
  const { membership } = useAuth();
  const [settings, setSettings] = useState<AcademySettings | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!membership) return;
      const ref = doc(db, "academies", membership.academyId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setSettings(snap.data() as AcademySettings);
      }
    }
    void loadSettings();
  }, [membership]);

  return (
    <Panel title="Settings">
      {settings ? (
        <div className="grid gap-2 text-sm">
          <p>
            <span className="text-muted">Academia:</span> {settings.name}
          </p>
          <p>
            <span className="text-muted">Slug:</span> {settings.slug}
          </p>
          <p>
            <span className="text-muted">Plan:</span> <span className="uppercase text-primary">{settings.plan}</span>
          </p>
          <p>
            <span className="text-muted">Límite alumnos:</span>{" "}
            {settings.planLimits?.maxStudents === null ? "Ilimitado" : (settings.planLimits?.maxStudents ?? "-")}
          </p>
          <p>
            <span className="text-muted">Status:</span> <span className="uppercase">{settings.status}</span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Cargando settings...</p>
      )}
    </Panel>
  );
}
