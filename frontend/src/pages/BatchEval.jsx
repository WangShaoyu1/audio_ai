import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, Play, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const BatchEval = () => {
  const { t } = useTranslation();

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
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{t('eval.dragDrop')}</p>
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

            <Button className="w-full">
              <Play className="mr-2 h-4 w-4" />
              {t('common.status')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('eval.history')}</CardTitle>
            <CardDescription>{t('eval.history')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Eval_Run_2024010{8-i}</div>
                    <div className="text-xs text-muted-foreground">50 cases • 98% Pass Rate</div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-3 w-3 mr-2" />
                    {t('common.download')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BatchEval;
