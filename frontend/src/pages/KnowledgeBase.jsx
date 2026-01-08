import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Upload, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const KnowledgeBase = () => {
  const { t } = useTranslation();
  // Mock data for now as backend endpoints might not be fully ready for file management
  const documents = [
    { id: 1, name: 'product_manual_v1.pdf', size: '2.4 MB', uploaded: '2024-01-08' },
    { id: 2, name: 'faq_list.docx', size: '156 KB', uploaded: '2024-01-07' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('kb.title')}</h2>
          <p className="text-muted-foreground">{t('nav.knowledgeBase')}</p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          {t('kb.upload')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kb.totalDocs')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kb.vectorStatus')}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('common.status')}</div>
            <p className="text-xs text-muted-foreground">PostgreSQL + pgvector</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('nav.knowledgeBase')}</CardTitle>
          <CardDescription>
            {t('kb.title')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 font-medium">{t('kb.table.name')}</th>
                  <th className="p-4 font-medium">{t('kb.table.size')}</th>
                  <th className="p-4 font-medium">{t('kb.table.date')}</th>
                  <th className="p-4 font-medium text-right">{t('kb.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                    <td className="p-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      {doc.name}
                    </td>
                    <td className="p-4 text-muted-foreground">{doc.size}</td>
                    <td className="p-4 text-muted-foreground">{doc.uploaded}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
