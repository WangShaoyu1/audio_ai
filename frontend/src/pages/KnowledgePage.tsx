import React, { useState } from 'react';
import { Upload, FileText, Trash2, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function KnowledgePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/api/v1/admin/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'success', text: 'Document uploaded and indexed successfully.' });
      setFile(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Upload documents (PDF, TXT, DOCX) to the RAG engine.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Area */}
        <div className="border border-dashed border-border rounded-xl p-8 text-center bg-card/30 hover:bg-card/50 transition-colors">
          <input
            type="file"
            accept=".pdf,.txt,.docx,.md"
            onChange={handleFileChange}
            className="hidden"
            id="kb-upload"
          />
          <label htmlFor="kb-upload" className="cursor-pointer flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-lg">
                {file ? file.name : "Click to upload document"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Supported formats: PDF, TXT, Markdown
              </div>
            </div>
          </label>
        </div>

        {/* Action Button */}
        {file && (
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload & Index
                </>
              )}
            </button>
          </div>
        )}

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/20 text-green-500' 
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            {message.text}
          </div>
        )}

        {/* Document List (Placeholder) */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Indexed Documents</h3>
          <div className="border border-border rounded-lg divide-y divide-border bg-card/30">
            {/* Mock Data */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="font-medium text-sm">product_manual_v{i}.pdf</div>
                    <div className="text-xs text-muted-foreground">Indexed on 2024-03-1{i}</div>
                  </div>
                </div>
                <button className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
