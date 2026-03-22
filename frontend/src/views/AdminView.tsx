import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/shared/Logo";
import { apiUrl } from "../utils/apiBase";

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

export default function AdminView() {
  const [users, setUsers] = useState<PlayerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/players/admin/users"));
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError("Impossible de charger les comptes (Redis requis).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRename = async (userId: string) => {
    if (!editName.trim() || editName.trim().length < 2) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/players/admin/users/${userId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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
      <p className="text-neutral-500 text-sm mb-6">
        Gestion des comptes joueurs
      </p>

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

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un joueur..."
        className="input-field max-w-md w-full mb-6"
      />

      {loading && <p className="text-neutral-500">Chargement...</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="w-full max-w-2xl space-y-3">
        {!loading && filtered.length === 0 && (
          <p className="text-neutral-500 text-center text-sm">
            {users.length === 0
              ? "Aucun compte créé pour le moment."
              : "Aucun résultat."}
          </p>
        )}

        {filtered.map((u) => (
          <motion.div
            key={u.id}
            layout
            className="card-glass"
          >
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
                  {u.games_played} partie(s) · {u.total_score} pts · {u.wins} W
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
    </div>
  );
}
