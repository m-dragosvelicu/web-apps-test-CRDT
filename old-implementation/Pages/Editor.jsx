import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CollaborativeEditor from "../components/editor/CollaborativeEditor";

export default function EditorPage() {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list("-created_date"),
    initialData: [],
  });

  // Create document mutation
  const createDocMutation = useMutation({
    mutationFn: async (title) => {
      return await base44.entities.Document.create({
        title,
        participant_ids: user ? [user.id] : [],
      });
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setSelectedDocId(newDoc.id);
      setNewDocTitle("");
    },
  });

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId) => {
      // Delete all operations first
      const operations = await base44.entities.Operation.filter({
        document_id: docId,
      });
      for (const op of operations) {
        await base44.entities.Operation.delete(op.id);
      }
      // Then delete document
      await base44.entities.Document.delete(docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setSelectedDocId(null);
    },
  });

  const handleCreateDoc = () => {
    if (newDocTitle.trim()) {
      createDocMutation.mutate(newDocTitle);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Collaborative Text Editor
          </h1>
          <p className="text-gray-600">
            Real-time collaboration with CRDT conflict resolution, per-client
            undo, and offline support
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Document List */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg sticky top-4">
              <CardHeader className="border-b bg-white">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Create new document */}
                <div className="space-y-2">
                  <Input
                    placeholder="New document title"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreateDoc()}
                  />
                  <Button
                    onClick={handleCreateDoc}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    disabled={!newDocTitle.trim()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create
                  </Button>
                </div>

                {/* Document list */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-3 rounded-lg border-2 transition-all cursor-pointer group hover:border-indigo-300 ${
                        selectedDocId === doc.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 bg-white"
                      }`}
                      onClick={() => setSelectedDocId(doc.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {doc.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(doc.created_date).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Delete this document?")) {
                              deleteDocMutation.mutate(doc.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && !isLoading && (
                    <div className="text-center text-gray-500 text-sm py-8">
                      No documents yet. Create one to get started!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Editor Area */}
          <div className="lg:col-span-3">
            {selectedDoc ? (
              <div>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedDoc.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Document ID: {selectedDoc.id}
                  </p>
                </div>
                <CollaborativeEditor documentId={selectedDoc.id} />
              </div>
            ) : (
              <Card className="shadow-lg h-[600px] flex items-center justify-center">
                <div className="text-center text-gray-500 space-y-4">
                  <FileText className="w-16 h-16 mx-auto text-gray-300" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      No Document Selected
                    </h3>
                    <p className="text-sm">
                      Select a document from the sidebar or create a new one
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Info Card */}
        <Card className="mt-6 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">
              How It Works:
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>
                  <strong>CRDT Conflict Resolution:</strong> Multiple users can
                  edit simultaneously. All changes merge deterministically with
                  no lost updates.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>
                  <strong>Per-Client Undo:</strong> Each user can undo only
                  their own changes without affecting others' work.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>
                  <strong>Offline Support:</strong> Keep working offline.
                  Changes queue up and sync automatically when you reconnect.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>
                  <strong>Real-Time Sync:</strong> See others' changes appear in
                  real-time with smooth updates.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
