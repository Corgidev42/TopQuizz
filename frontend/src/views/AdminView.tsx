import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/shared/Logo";
import { apiUrl } from "../utils/apiBase";

const ADMIN_TOKEN_KEY = "topquizz_admin_token";

interface PlayerUser {
  id: string;
  email: string;
  display_name: string;
  avatar_emoji: string;
  games_played: number;
  total_score: number;
  wins: number;
  created_at: number;
}

interface AuthAuditRow {
  id: number;
  created_at: number;
  request_id: string;
  kind: string;
  success: boolean;
  reason_code: string | null;
  public_message: string | null;
  http_status: number;
  client_ip: string;
  user_agent: string;
  email_hint: string | null;
  internal_detail: string | null;
}

function adminHeaders(): HeadersInit {
  const tok =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(ADMIN_TOKEN_KEY)
      : null;
  const h: Record<string, string> = {};
  if (tok) h["X-TopQuizz-Admin-Token"] = tok;
  return h;
}

export default function AdminView() {
  const [tab, setTab] = useState<"accounts" | "audit">("accounts");
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [users, setUsers] = useState<PlayerUser[]>([]);
  const [auditRows, setAuditRows] = useState<AuthAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [failuresOnly, setFailuresOnly] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) setAdminTokenInput(saved);
  }, []);

  const saveAdminToken = () => {
    const v = adminTokenInput.trim();
    if (v) sessionStorage.setItem(ADMIN_TOKEN_KEY, v);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    showToast(v ? "Jeton enregistré (session)" : "Jeton effacé");
    if (tab === "audit") void fetchAudit();
    void fetchUsers();
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/players/admin/users"), {
        headers: adminHeaders(),
      });
      if (res.status === 403) {
        setError(
          "Accès refusé : connecte-toi depuis le réseau local (Wi-Fi du serveur) ou renseigne le jeton TOPQUIZZ_ADMIN_TOKEN ci-dessous.",
        );
        setUsers([]);
        return;
      }
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError("Impossible de charger les comptes (serveur ou base).");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const q = new URLSearchParams({
        limit: "200",
        offset: "0",
        failures_only: failuresOnly ? "true" : "false",
      });
      const res = await fetch(apiUrl(`/api/players/admin/auth-audit?${q}`), {
        headers: adminHeaders(),
      });
      if (res.status === 403) {
        setAuditError(
          "Même règle que pour les comptes : IP locale ou jeton admin.",
        );
        setAuditRows([]);
        return;
      }
      if (!res.ok) throw new Error("audit");
      const data = await res.json();
      setAuditRows(data.events ?? []);
    } catch {
      setAuditError("Impossible de charger le journal.");
    } finally {
      setAuditLoading(false);
    }
  }, [failuresOnly]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (tab === "audit") void fetchAudit();
  }, [tab, fetchAudit]);

  const handleRename = async (userId: string) => {
    if (!editName.trim() || editName.trim().length < 2) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/players/admin/users/${userId}`), {
        method: "PATCH",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: editName.trim() }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      showToast("Pseudo modifié");
      await fetchUsers();
    } catch {
      showToast("Erreur lors du renommage");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (newPassword.length < 6) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/players/admin/users/${userId}/reset-password`),
        {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: newPassword }),
        },
      );
      if (!res.ok) throw new Error();
      setResetPwId(null);
      setNewPassword("");
      showToast("Mot de passe réinitialisé");
    } catch {
      showToast("Erreur lors de la réinitialisation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Supprimer le compte de "${name}" ? Cette action est irréversible.`))
      return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/players/admin/users/${userId}`), {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error();
      showToast(`Compte "${name}" supprimé`);
      await fetchUsers();
    } catch {
      showToast("Erreur lors de la suppression");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative z-10">
      <Link
        to="/"
        className="self-start text-neutral-400 hover:text-brand-orange mb-4"
      >
        ← Accueil
      </Link>
      <Logo size="md" />
      <h1 className="text-2xl font-black mt-4 mb-2">Administration</h1>
      <p className="text-neutral-500 text-sm mb-4 text-center max-w-lg">
        Comptes joueurs et journal des tentatives d’inscription / connexion
        (requêtes atteignant le backend uniquement).
      </p>

      <div className="card-glass max-w-2xl w-full mb-6 p-4 space-y-3">
        <div className="text-xs text-neutral-400">
          Accès : même Wi-Fi / LAN que le serveur, ou jeton{" "}
          <code className="text-neutral-300">TOPQUIZZ_ADMIN_TOKEN</code> (fichier{" "}
          <code className="text-neutral-300">.env</code> + redémarrage backend).
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            className="input-field flex-1 text-sm"
            placeholder="Jeton admin (optionnel)"
            value={adminTokenInput}
            onChange={(e) => setAdminTokenInput(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn-primary px-4 text-sm shrink-0"
            onClick={saveAdminToken}
          >
            Enregistrer le jeton
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "accounts"
              ? "bg-brand-orange text-white"
              : "btn-secondary"
          }`}
          onClick={() => setTab("accounts")}
        >
          Comptes
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "audit" ? "bg-brand-orange text-white" : "btn-secondary"
          }`}
          onClick={() => setTab("audit")}
        >
          Journal auth
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-orange text-white px-5 py-2 rounded-xl font-semibold shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {tab === "accounts" && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un joueur..."
            className="input-field max-w-md w-full mb-6"
          />

          {loading && <p className="text-neutral-500">Chargement...</p>}
          {error && <p className="text-red-400 text-sm mb-4 max-w-xl">{error}</p>}

          <div className="w-full max-w-2xl space-y-3">
            {!loading && filtered.length === 0 && (
              <p className="text-neutral-500 text-center text-sm">
                {users.length === 0
                  ? "Aucun compte créé pour le moment."
                  : "Aucun résultat."}
              </p>
            )}

            {filtered.map((u) => (
              <motion.div key={u.id} layout className="card-glass">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{u.avatar_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{u.display_name}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {u.email}
                    </div>
                  </div>
                  <div className="text-right text-xs text-neutral-500 shrink-0">
                    <div>
                      {u.games_played} partie(s) · {u.total_score} pts · {u.wins}{" "}
                      W
                    </div>
                    <div>
                      Inscrit le{" "}
                      {new Date(u.created_at * 1000).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </div>

                {editingId === u.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input-field flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nouveau pseudo"
                      minLength={2}
                    />
                    <button
                      type="button"
                      className="btn-primary px-4 text-sm"
                      disabled={actionLoading}
                      onClick={() => handleRename(u.id)}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 text-sm"
                      onClick={() => setEditingId(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : resetPwId === u.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="password"
                      className="input-field flex-1"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe (6+ car.)"
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="btn-primary px-4 text-sm"
                      disabled={actionLoading || newPassword.length < 6}
                      onClick={() => handleResetPassword(u.id)}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 text-sm"
                      onClick={() => {
                        setResetPwId(null);
                        setNewPassword("");
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => {
                        setEditingId(u.id);
                        setEditName(u.display_name);
                        setResetPwId(null);
                      }}
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => {
                        setResetPwId(u.id);
                        setNewPassword("");
                        setEditingId(null);
                      }}
                    >
                      Reset mot de passe
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs border-red-500/40 text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDelete(u.id, u.display_name)}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-sm text-neutral-500">
            {users.length} compte(s) enregistré(s)
          </div>
        </>
      )}

      {tab === "audit" && (
        <div className="w-full max-w-5xl space-y-4">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={failuresOnly}
                onChange={(e) => setFailuresOnly(e.target.checked)}
              />
              Échecs seulement
            </label>
            <button
              type="button"
              className="btn-secondary text-sm px-3 py-1"
              onClick={() => void fetchAudit()}
              disabled={auditLoading}
            >
              Rafraîchir
            </button>
          </div>

          {auditLoading && <p className="text-neutral-500">Chargement du journal…</p>}
          {auditError && (
            <p className="text-red-400 text-sm max-w-2xl">{auditError}</p>
          )}

          <p className="text-xs text-neutral-500 max-w-3xl">
            Les erreurs purement réseau côté téléphone (requête qui n’atteint jamais
            le serveur, certificat refusé, DNS, etc.) ne peuvent pas apparaître ici :
            seules les tentatives vues par l’API sont enregistrées. Utilise la colonne{" "}
            <strong>req</strong> pour recouper avec les logs Docker du backend.
          </p>

          {!auditLoading && auditRows.length === 0 && !auditError && (
            <p className="text-neutral-500 text-sm">Aucune entrée pour l’instant.</p>
          )}

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-black/30 text-neutral-400">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">OK</th>
                  <th className="p-2">Code</th>
                  <th className="p-2">HTTP</th>
                  <th className="p-2">IP</th>
                  <th className="p-2">Email (masqué)</th>
                  <th className="p-2 min-w-[140px]">Message</th>
                  <th className="p-2 min-w-[160px]">Détail technique</th>
                  <th className="p-2">req</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="p-2 whitespace-nowrap text-neutral-300">
                      {new Date(r.created_at * 1000).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-2">{r.kind}</td>
                    <td className="p-2">{r.success ? "✓" : "✗"}</td>
                    <td className="p-2 text-neutral-400">{r.reason_code ?? "—"}</td>
                    <td className="p-2">{r.http_status}</td>
                    <td className="p-2 font-mono text-[10px] sm:text-xs">
                      {r.client_ip || "—"}
                    </td>
                    <td className="p-2 text-neutral-400 break-all max-w-[120px]">
                      {r.email_hint || "—"}
                    </td>
                    <td className="p-2 text-neutral-300 max-w-[200px] break-words">
                      {r.public_message ?? "—"}
                    </td>
                    <td className="p-2 text-neutral-500 font-mono text-[10px] sm:text-xs max-w-[220px] break-all">
                      {r.internal_detail ?? "—"}
                    </td>
                    <td className="p-2 font-mono text-[10px] text-neutral-500 max-w-[72px] truncate" title={r.request_id}>
                      {r.request_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
