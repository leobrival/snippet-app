import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { initDB, getSnippets, createSnippet, updateSnippet, deleteSnippet } from "./db";
import type { Snippet, RaycastSnippet } from "./types";
import { extractArguments } from "./parser";
import { executeSnippet, copyToClipboard } from "./executor";
import { logger } from "./logger";
import "./App.css";

function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [argumentValues, setArgumentValues] = useState<Record<string, string>>({});
  const [executionResult, setExecutionResult] = useState<{ result: string; cursorIndex: number | null } | null>(null);

  // Form state for add/edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [formData, setFormData] = useState({ keyword: "", name: "", text: "" });

  // Import/Export state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<RaycastSnippet[] | null>(null);

  // Auto-expansion state
  const [autoExpansionEnabled, setAutoExpansionEnabled] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [hasAccessibilityPermissions, setHasAccessibilityPermissions] = useState<boolean | null>(null);

  useEffect(() => {
    loadSnippets();
    enableAutoExpansionOnStartup();
  }, []);

  useEffect(() => {
    // Sync active snippets to backend whenever they change
    syncSnippetsToBackend();
  }, [snippets]);

  async function enableAutoExpansionOnStartup() {
    try {
      await invoke("enable_auto_expansion");
      setAutoExpansionEnabled(true);
      logger.info("Auto-expansion enabled on startup");

      // Check if accessibility permissions are granted
      setTimeout(async () => {
        await checkPermissions();
      }, 1000);
    } catch (error) {
      logger.error("Failed to enable auto-expansion", { error });
      setAutoExpansionEnabled(false);
      setShowPermissionGuide(true);
    }
  }

  async function checkPermissions() {
    try {
      const hasPermissions = await invoke<boolean>("check_accessibility_permissions");
      setHasAccessibilityPermissions(hasPermissions);
      logger.info("Accessibility permissions check", { hasPermissions });

      if (!hasPermissions) {
        setShowPermissionGuide(true);
      }
    } catch (error) {
      logger.error("Failed to check permissions", { error });
      setHasAccessibilityPermissions(false);
    }
  }

  async function syncSnippetsToBackend() {
    const activeSnippets = snippets.filter((s) => s.active);
    const keywords = activeSnippets.map((s) => s.keyword);
    const texts = activeSnippets.map((s) => s.text);

    try {
      await invoke("update_snippets_map", { keywords, texts });
      logger.debug("Snippets synced to backend", { count: activeSnippets.length });
    } catch (error) {
      logger.error("Failed to sync snippets", { error });
    }
  }

  async function toggleAutoExpansion() {
    try {
      if (autoExpansionEnabled) {
        await invoke("disable_auto_expansion");
        setAutoExpansionEnabled(false);
        logger.info("Auto-expansion disabled");
      } else {
        await invoke("enable_auto_expansion");
        setAutoExpansionEnabled(true);
        logger.info("Auto-expansion enabled");
      }
    } catch (error) {
      logger.error("Failed to toggle auto-expansion", { error });
      alert("Failed to toggle auto-expansion. Check console logs.");
    }
  }

  async function loadSnippets() {
    setIsLoading(true);
    await initDB();
    const data = await getSnippets();
    setSnippets(data);
    setIsLoading(false);
  }

  async function handleCreate() {
    await createSnippet({ ...formData, active: true });
    await loadSnippets();
    setIsFormOpen(false);
    setFormData({ keyword: "", name: "", text: "" });
  }

  async function handleUpdate() {
    if (!editingSnippet?.id) return;
    await updateSnippet(editingSnippet.id, formData);
    await loadSnippets();
    setIsFormOpen(false);
    setEditingSnippet(null);
    setFormData({ keyword: "", name: "", text: "" });
  }

  async function handleDelete(id: number) {
    if (confirm("Delete this snippet?")) {
      await deleteSnippet(id);
      await loadSnippets();
    }
  }

  async function handleToggleActive(snippet: Snippet) {
    if (!snippet.id) return;
    await updateSnippet(snippet.id, { active: !snippet.active });
    await loadSnippets();
  }

  function openExecute(snippet: Snippet) {
    setSelectedSnippet(snippet);
    const args = extractArguments(snippet.text);
    const defaultValues: Record<string, string> = {};
    args.forEach((arg) => {
      defaultValues[arg.name] = arg.default || "";
    });
    setArgumentValues(defaultValues);
    setExecutionResult(null);
    setIsExecuting(true);
  }

  async function handleExecute() {
    if (!selectedSnippet) return;
    const result = await executeSnippet(selectedSnippet.text, argumentValues);
    setExecutionResult(result);
  }

  async function handleCopy() {
    if (!executionResult) return;
    await copyToClipboard(executionResult.result);
    setIsExecuting(false);
    setSelectedSnippet(null);
    setExecutionResult(null);
  }

  function handleParseImport() {
    try {
      const parsed = JSON.parse(importText) as RaycastSnippet[];
      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      if (parsed.some((s) => !s.keyword || !s.name || !s.text)) {
        throw new Error("Invalid format: missing required fields");
      }
      setImportPreview(parsed);
    } catch (error) {
      alert(`Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    for (const snippet of importPreview) {
      await createSnippet({ ...snippet, active: true });
    }
    await loadSnippets();
    setIsImportOpen(false);
    setImportText("");
    setImportPreview(null);
  }

  async function handleImportFile() {
    const file = await open({
      title: "Select Raycast Snippets JSON",
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });

    if (!file) return;

    try {
      const response = await fetch(`file://${file}`);
      const text = await response.text();
      const parsed = JSON.parse(text) as RaycastSnippet[];

      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      if (parsed.some((s) => !s.keyword || !s.name || !s.text)) {
        throw new Error("Invalid format: missing required fields");
      }

      setImportText(text);
      setImportPreview(parsed);
      setIsImportOpen(true);
    } catch (error) {
      alert(`Failed to import file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function handleExport() {
    const exportData: RaycastSnippet[] = snippets.map((s) => ({
      keyword: s.keyword,
      name: s.name,
      text: s.text,
    }));
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snippets.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredSnippets = snippets.filter(
    (s) =>
      s.keyword.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Snippet Runner</h1>
            <div className="flex flex-col gap-1">
              <button
                onClick={toggleAutoExpansion}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  autoExpansionEnabled
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                }`}
              >
                {autoExpansionEnabled ? "✓ Auto-Expand ON" : "Auto-Expand OFF"}
              </button>
              {autoExpansionEnabled && (
                <p className="text-xs text-gray-600">
                  Requires Accessibility permissions (System Settings → Privacy & Security)
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsImportOpen(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Import (Paste)
            </button>
            <button
              onClick={handleImportFile}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Import File
            </button>
            <button
              onClick={handleExport}
              disabled={snippets.length === 0}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
            >
              Export
            </button>
            <button
              onClick={() => {
                setEditingSnippet(null);
                setFormData({ keyword: "", name: "", text: "" });
                setIsFormOpen(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + New Snippet
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by keyword or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {isLoading ? (
          <p className="text-gray-500">Loading snippets...</p>
        ) : filteredSnippets.length === 0 ? (
          <p className="text-gray-500">No snippets found. Create your first one!</p>
        ) : (
          <div className="space-y-3">
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className={`bg-white p-4 rounded-lg shadow ${!snippet.active ? "opacity-50" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {snippet.keyword}
                      </span>
                      <h3 className="font-semibold text-gray-900">{snippet.name}</h3>
                      {!snippet.active && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{snippet.text}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openExecute(snippet)}
                      disabled={!snippet.active}
                      className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => {
                        setEditingSnippet(snippet);
                        setFormData({ keyword: snippet.keyword, name: snippet.name, text: snippet.text });
                        setIsFormOpen(true);
                      }}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(snippet)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      {snippet.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => snippet.id && handleDelete(snippet.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4">
                {editingSnippet ? "Edit Snippet" : "New Snippet"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keyword
                  </label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
                  <textarea
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported placeholders: {"{clipboard}"}, {"{cursor}"}, {'{argument name="..." options="..." default="..."}'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingSnippet(null);
                    setFormData({ keyword: "", name: "", text: "" });
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={editingSnippet ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingSnippet ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Execute Modal */}
        {isExecuting && selectedSnippet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4">Execute: {selectedSnippet.name}</h2>

              {!executionResult && (
                <>
                  {extractArguments(selectedSnippet.text).map((arg) => (
                    <div key={arg.name} className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {arg.name}
                      </label>
                      {arg.options ? (
                        <select
                          value={argumentValues[arg.name] || ""}
                          onChange={(e) =>
                            setArgumentValues({ ...argumentValues, [arg.name]: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {arg.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={argumentValues[arg.name] || ""}
                          onChange={(e) =>
                            setArgumentValues({ ...argumentValues, [arg.name]: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setIsExecuting(false);
                        setSelectedSnippet(null);
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExecute}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Execute
                    </button>
                  </div>
                </>
              )}

              {executionResult && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                    <textarea
                      value={executionResult.result}
                      readOnly
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                    />
                    {executionResult.cursorIndex !== null && (
                      <p className="text-xs text-gray-500 mt-1">
                        Cursor position: {executionResult.cursorIndex}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setIsExecuting(false);
                        setSelectedSnippet(null);
                        setExecutionResult(null);
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleCopy}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Import Modal */}
        {isImportOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4">Import Snippets (Raycast Format)</h2>

              {!importPreview ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paste JSON (Raycast format)
                    </label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={12}
                      placeholder={`[\n  {\n    "keyword": "email",\n    "name": "My Email",\n    "text": "hello@example.com"\n  }\n]`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setIsImportOpen(false);
                        setImportText("");
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleParseImport}
                      disabled={!importText.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Parse & Preview
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Found {importPreview.length} snippet(s) to import:
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-300 rounded-lg p-3">
                      {importPreview.map((snippet, idx) => (
                        <div key={idx} className="bg-gray-50 p-2 rounded">
                          <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                            {snippet.keyword}
                          </span>
                          <span className="text-sm ml-2">{snippet.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setImportPreview(null)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Import {importPreview.length} Snippet(s)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Permission Guide Modal */}
        {showPermissionGuide && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full">
              <h2 className="text-xl font-bold mb-4">🔐 Activer l'Auto-Expansion</h2>

              <div className="mb-6">
                {/* Permission Status */}
                {hasAccessibilityPermissions !== null && (
                  <div className={`mb-4 p-3 rounded-lg border ${
                    hasAccessibilityPermissions
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <p className={`text-sm font-semibold ${
                      hasAccessibilityPermissions ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {hasAccessibilityPermissions
                        ? '✅ Permissions activées - L\'auto-expansion fonctionne !'
                        : '❌ Permissions manquantes - Suivez les étapes ci-dessous'}
                    </p>
                  </div>
                )}

                <p className="text-gray-700 mb-4">
                  Pour que l'auto-expansion fonctionne, vous devez autoriser l'app à accéder au clavier.
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Étapes à suivre :</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900">
                    <li>Ouvrez <strong>Réglages Système</strong> (System Settings)</li>
                    <li>Allez dans <strong>Confidentialité et sécurité</strong> (Privacy & Security)</li>
                    <li>Cliquez sur <strong>Accessibilité</strong> (Accessibility)</li>
                    <li>Cliquez sur le <strong>+</strong> et ajoutez <strong>snippet-app</strong></li>
                    <li>Cochez la case à côté de l'app</li>
                  </ol>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-900">
                    ⚠️ Vous devrez peut-être redémarrer l'app après avoir activé les permissions.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={checkPermissions}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  🔄 Vérifier à nouveau
                </button>
                <button
                  onClick={() => setShowPermissionGuide(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {hasAccessibilityPermissions ? 'Fermer' : 'J\'ai compris'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
