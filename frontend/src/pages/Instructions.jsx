import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Save, Trash2, Code, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

const Instructions = () => {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // New Instruction Form State
  const [newInst, setNewInst] = useState({
    name: '',
    description: '',
    parameters: '{}',
    mutex_config: '{}'
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchInstructions();
  }, []);

  const fetchInstructions = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/instructions');
      setInstructions(data);
    } catch (error) {
      console.error('Failed to fetch instructions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const payload = {
        ...newInst,
        parameters: JSON.parse(newInst.parameters),
        mutex_config: JSON.parse(newInst.mutex_config),
        is_active: true
      };
      
      await api.post('/admin/instructions', payload);
      setIsDialogOpen(false);
      fetchInstructions();
      setNewInst({ name: '', description: '', parameters: '{}', mutex_config: '{}' });
    } catch (error) {
      alert('Failed to create instruction: ' + error.message);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/admin/instructions/import', formData);
      
      alert(`Imported: ${result.success} success, ${result.failed} failed.`);
      fetchInstructions();
    } catch (error) {
      alert('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('inst.title')}</h2>
          <p className="text-muted-foreground">Manage Function Calling Definitions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInstructions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          <div className="relative">
            <input
              type="file"
              accept=".xlsx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleImport}
              disabled={importing}
            />
            <Button variant="outline" disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Importing...' : 'Import Excel'}
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Instruction
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Instruction</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input 
                    value={newInst.name}
                    onChange={(e) => setNewInst({...newInst, name: e.target.value})}
                    placeholder="e.g., set_microwave_time"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input 
                    value={newInst.description}
                    onChange={(e) => setNewInst({...newInst, description: e.target.value})}
                    placeholder="Function description for LLM"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Parameters (JSON)</Label>
                  <Textarea 
                    value={newInst.parameters}
                    onChange={(e) => setNewInst({...newInst, parameters: e.target.value})}
                    className="font-mono text-xs"
                    rows={5}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Mutex Config (JSON)</Label>
                  <Textarea 
                    value={newInst.mutex_config}
                    onChange={(e) => setNewInst({...newInst, mutex_config: e.target.value})}
                    className="font-mono text-xs"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {instructions.map((inst) => (
          <Card key={inst.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                {inst.name}
              </CardTitle>
              <CardDescription>{inst.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-xs bg-muted p-2 rounded font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {JSON.stringify(inst.parameters)}
              </div>
            </CardContent>
          </Card>
        ))}
        {instructions.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            No instructions found. Create one or import from Excel.
          </div>
        )}
      </div>
    </div>
  );
};

export default Instructions;
