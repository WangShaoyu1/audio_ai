import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, Play, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api } from '@/lib/api';

const BatchEval = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRunEval = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const blob = await api.download('/admin/eval/batch', formData);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eval_result_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('Evaluation completed and report downloaded.');
    } catch (error) {
      console.error('Eval failed:', error);
      alert('Evaluation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('eval.title')}</h2>
        <p className="text-muted-foreground">{t('nav.batchEval')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('eval.upload')}</CardTitle>
            <CardDescription>{t('eval.dragDrop')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
              <input 
                type="file" 
                accept=".xlsx"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {file ? file.name : t('eval.dragDrop')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx files only</p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md text-xs space-y-2">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {t('eval.requirements')}:
              </p>
              <ul className="list-disc list-inside text-muted-foreground pl-1">
                <li>case_id</li>
                <li>query</li>
                <li>expected_intent</li>
                <li>expected_keywords</li>
              </ul>
            </div>

            <Button 
              className="w-full" 
              onClick={handleRunEval} 
              disabled={!file || loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {loading ? 'Running Evaluation...' : 'Run Evaluation'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('eval.history')}</CardTitle>
            <CardDescription>Recent evaluation runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              History feature coming soon.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BatchEval;
