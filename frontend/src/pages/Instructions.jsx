import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const Instructions = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('inst.title')}</h2>
          <p className="text-muted-foreground">{t('nav.instructions')}</p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          {t('inst.save')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('inst.systemPrompt')}</CardTitle>
          <CardDescription>{t('inst.systemPrompt')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('inst.systemPrompt')}</label>
            <textarea 
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue="You are a helpful AI assistant capable of voice interaction. You should provide concise, spoken-style responses."
            />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('inst.maxTokens')}</label>
              <Input type="number" defaultValue={500} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('inst.temperature')}</label>
              <Input type="number" step="0.1" defaultValue={0.7} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Instructions;
