import { Fragment, useState } from "react";
import { DatabaseAggregate, DatabaseItem, fetchDatabaseAggregates, PlatformFeatures } from "../../api";
import { SECTION_IDS } from "../../sections";

interface Props {
  databases: DatabaseItem[];
  features: PlatformFeatures | null;
  canUpload: boolean;
  uploading: boolean;
  showPgForm: boolean;
  pgName: string;
  pgUrl: string;
  pgReplicaUrl: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPgConnect: () => void;
  onTogglePg: () => void;
  onRemove: (databaseId: string, filename: string) => void;
  onRefreshAggregates: (databaseId: string) => void;
  setPgName: (v: string) => void;
  setPgUrl: (v: string) => void;
  setPgReplicaUrl: (v: string) => void;
}

export default function DatabasesPage({
  databases, features, canUpload, uploading, showPgForm, pgName, pgUrl, pgReplicaUrl,
  onUpload, onPgConnect, onTogglePg, onRemove, onRefreshAggregates,
  setPgName, setPgUrl, setPgReplicaUrl,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aggregatesDbId, setAggregatesDbId] = useState<string | null>(null);
  const [aggregates, setAggregates] = useState<DatabaseAggregate[]>([]);
  const [aggregatesLoading, setAggregatesLoading] = useState(false);
  const enterprise = features?.enterprise_mode ?? false;
  const allowUploads = features?.allow_sqlite_uploads ?? true;

  async function handleRemove(id: string, filename: string) {
    if (!confirm(`Disconnect and remove "${filename}"? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await onRemove(id, filename);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefresh(id: string) {
    setBusyId(id);
    try {
      await onRefreshAggregates(id);
      if (aggregatesDbId === id) await loadAggregates(id);
    } finally {
      setBusyId(null);
    }
  }

  async function loadAggregates(id: string) {
    setAggregatesLoading(true);
    try {
      setAggregates(await fetchDatabaseAggregates(id));
    } catch {
      setAggregates([]);
    } finally {
      setAggregatesLoading(false);
    }
  }

  async function toggleAggregates(id: string) {
    if (aggregatesDbId === id) {
      setAggregatesDbId(null);
      return;
    }
    setAggregatesDbId(id);
    await loadAggregates(id);
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="mono-label">Data Management</p>
        <h3 className="mt-2 text-3xl font-bold text-white">Company Data Sources</h3>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          {enterprise
            ? "Connect PostgreSQL or warehouse data sources. File uploads are disabled for enterprise-scale deployments."
            : "Upload or connect databases for your organization. Only company admins can manage data sources."}
        </p>
        {features && (
          <div className="mt-4 flex flex-wrap gap-2">
            {features.encrypted_connections && <span className="tag border-ink-600 text-ink-400">Encrypted at rest</span>}
            {features.read_replicas && <span className="tag border-ink-600 text-ink-400">Read replicas</span>}
            {features.async_queries_enabled && <span className="tag border-ink-600 text-ink-400">Async queries</span>}
            {features.schema_sampling && <span className="tag border-ink-600 text-ink-400">Schema sampling</span>}
          </div>
        )}
      </div>

      {canUpload ? (
        <div className={`grid gap-8 ${allowUploads ? "lg:grid-cols-2" : ""}`}>
          {allowUploads && (
            <div className="panel p-8">
              <p className="mono-label">SQLite Upload</p>
              <label className="upload-zone mt-6 block cursor-pointer">
                <span className="font-mono text-2xl text-ink-600">+</span>
                <span className="mt-4 block font-medium text-ink-300">{uploading ? "Uploading…" : "Upload database file"}</span>
                <span className="mono-label mt-2 block">.db · .sqlite · {features?.max_upload_mb ?? 100}MB max</span>
                <input type="file" accept=".db,.sqlite,.sqlite3" className="hidden" onChange={onUpload} disabled={uploading} />
              </label>
            </div>
          )}
          <div className="panel p-8">
            <p className="mono-label">{enterprise ? "Warehouse Connector" : "PostgreSQL / Redshift"}</p>
            <p className="mt-2 text-sm text-ink-500">
              Connect live PostgreSQL or Redshift warehouses with optional read replica for query routing.
            </p>
            <button type="button" onClick={onTogglePg} className="btn-ghost mt-6 w-full">{showPgForm ? "Cancel" : "Connect Data Source"}</button>
            {showPgForm && (
              <div className="mt-4 space-y-3">
                <input value={pgName} onChange={(e) => setPgName(e.target.value)} placeholder="Connection name" className="input-ink text-sm" />
                <input value={pgUrl} onChange={(e) => setPgUrl(e.target.value)} placeholder="postgresql:// or redshift://user:pass@host:5432/db" className="input-ink text-sm" />
                <input value={pgReplicaUrl} onChange={(e) => setPgReplicaUrl(e.target.value)} placeholder="Read replica URL (optional)" className="input-ink text-sm" />
                <button type="button" onClick={onPgConnect} disabled={uploading} className="btn-ink w-full text-sm">Connect</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="panel border border-ink-600 p-8">
          <p className="text-ink-400">Database management is restricted to company administrators.</p>
        </div>
      )}

      <div id={SECTION_IDS.databaseList} className="panel scroll-mt-28 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 bg-ink-900">
            <tr>
              <th className="mono-label px-6 py-4">Database</th>
              <th className="mono-label px-6 py-4">Type</th>
              <th className="mono-label px-6 py-4">Tables</th>
              <th className="mono-label px-6 py-4">Added</th>
              {canUpload && <th className="mono-label px-6 py-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {databases.length === 0 && (
              <tr>
                <td colSpan={canUpload ? 5 : 4} className="px-6 py-10 text-center text-ink-500">
                  No databases connected yet.
                </td>
              </tr>
            )}
            {databases.map((db) => {
              const isWarehouse = db.source_type === "postgres" || db.source_type === "redshift";
              const busy = busyId === db.id;
              const showAggregates = aggregatesDbId === db.id;
              return (
                <Fragment key={db.id}>
                  <tr className="border-b border-ink-900">
                    <td className="px-6 py-4 font-medium text-white">{db.filename}</td>
                    <td className="px-6 py-4 text-ink-400">{db.source_type}</td>
                    <td className="px-6 py-4 text-ink-400">{db.table_count}</td>
                    <td className="px-6 py-4 text-ink-500">{new Date(db.created_at).toLocaleDateString()}</td>
                    {canUpload && (
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAggregates(db.id)}
                            disabled={busy}
                            className="btn-ghost text-xs"
                          >
                            {showAggregates ? "Hide aggregates" : "Aggregates"}
                          </button>
                          {isWarehouse && (
                            <button
                              type="button"
                              onClick={() => handleRefresh(db.id)}
                              disabled={busy}
                              className="btn-ghost text-xs"
                              title="Refresh materialized aggregates"
                            >
                              {busy ? "…" : "Refresh"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemove(db.id, db.filename)}
                            disabled={busy}
                            className="btn-ghost text-xs text-ink-500 hover:text-white"
                          >
                            Disconnect
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {showAggregates && (
                    <tr key={`${db.id}-aggregates`} className="border-b border-ink-900 bg-ink-950">
                      <td colSpan={canUpload ? 5 : 4} className="px-6 py-4">
                        {aggregatesLoading ? (
                          <p className="text-xs text-ink-500">Loading aggregates…</p>
                        ) : aggregates.length === 0 ? (
                          <p className="text-xs text-ink-500">No pre-built aggregates for this source.</p>
                        ) : (
                          <ul className="space-y-2">
                            {aggregates.map((agg) => (
                              <li key={agg.id} className="text-xs text-ink-400">
                                <span className="font-medium text-white">{agg.name}</span>
                                {agg.description && <span className="text-ink-500"> — {agg.description}</span>}
                                {agg.last_refreshed_at && (
                                  <span className="ml-2 font-mono text-[10px] text-ink-600">
                                    refreshed {new Date(agg.last_refreshed_at).toLocaleString()}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
