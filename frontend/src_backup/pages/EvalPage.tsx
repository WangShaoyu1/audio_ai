import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { cn } from '@/lib/utils';

export default function EvalPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResultUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/v1/admin/eval/batch', formData, {
        responseType: 'blob', // Important for file download
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      setResultUrl(url);
    } catch (err: any) {
      console.error('Eval failed:', err);
      setError(err.message || 'Evaluation failed. Please check the file format.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Batch Evaluation</h1>
        <p className="text-muted-foreground">
          Upload an Excel file to run automated tests against the current model configuration.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Card */}
        <div className="border border-dashed border-border rounded-xl p-8 text-center bg-card/30 hover:bg-card/50 transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="eval-upload"
          />
          <label htmlFor="eval-upload" className="cursor-pointer flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-lg">
                {file ? file.name : "Click to upload Excel file"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Required columns: case_id, query, expected_intent, expected_keywords
              </div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          {file && !resultUrl && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Evaluation...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Start Evaluation
                </>
              )}
            </button>
          )}
        </div>

        {/* Result */}
        {resultUrl && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <div className="font-medium text-green-500">Evaluation Completed</div>
                <div className="text-sm text-green-500/80">Download the report to view detailed metrics.</div>
              </div>
            </div>
            <a
              href={resultUrl}
              download={`eval_result_${Date.now()}.xlsx`}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Report
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <div>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
