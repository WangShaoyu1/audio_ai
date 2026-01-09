import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Upload, Trash2, FileText, Settings, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

const KnowledgeBase = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // RAG Config State
  const [config, setConfig] = useState({
    index_mode: 'high_quality',
    retrieval_mode: 'hybrid',
    rerank_enabled: true,
    top_k: 5,
    score_threshold: 0.35
  });

  // Recall Test State
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchDocuments();
    // TODO: Fetch real config from backend
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const docs = await api.get('/admin/documents');
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      await api.upload('/admin/documents/upload', formData);
      await fetchDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRecallTest = async () => {
    if (!testQuery.trim()) return;
    try {
      setTesting(true);
      // Mock test for now until backend endpoint is ready
      // const results = await api.post('/admin/rag/test', { query: testQuery });
      // setTestResults(results);
      
      // Temporary Mock
      setTimeout(() => {
        setTestResults([
          { content: "Sample content matching query...", score: 0.89 },
          { content: "Another relevant document fragment...", score: 0.75 }
        ]);
        setTesting(false);
      }, 1000);
    } catch (error) {
      console.error('Test failed:', error);
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('kb.title')}</h2>
          <p className="text-muted-foreground">{t('nav.knowledgeBase')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDocuments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading...' : t('kb.upload')}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('kb.title')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            RAG Settings
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Recall Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
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
                <div className="text-2xl font-bold">Active</div>
                <p className="text-xs text-muted-foreground">PostgreSQL + pgvector</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-4 font-medium">{t('kb.table.name')}</th>
                      <th className="p-4 font-medium">{t('common.status')}</th>
                      <th className="p-4 font-medium">{t('kb.table.date')}</th>
                      <th className="p-4 font-medium text-right">{t('kb.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          No documents found. Upload one to get started.
                        </td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                          <td className="p-4 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            {doc.filename}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              doc.status === 'indexed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Settings</CardTitle>
              <CardDescription>Configure indexing strategy and retrieval parameters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Indexing Mode</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${config.index_mode === 'high_quality' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => setConfig({...config, index_mode: 'high_quality'})}
                  >
                    <div className="font-medium mb-1">High Quality</div>
                    <div className="text-sm text-muted-foreground">Uses advanced embedding models for better semantic understanding. Slower but more accurate.</div>
                  </div>
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${config.index_mode === 'economy' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => setConfig({...config, index_mode: 'economy'})}
                  >
                    <div className="font-medium mb-1">Economy</div>
                    <div className="text-sm text-muted-foreground">Uses smaller models and keyword indexing. Faster and cheaper, but less accurate.</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Retrieval Settings</h3>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Retrieval Mode</Label>
                    <Select 
                      value={config.retrieval_mode} 
                      onValueChange={(v) => setConfig({...config, retrieval_mode: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vector">Vector Search</SelectItem>
                        <SelectItem value="full_text">Full-Text Search</SelectItem>
                        <SelectItem value="hybrid">Hybrid Search (Recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Rerank Model</Label>
                      <div className="text-sm text-muted-foreground">Re-order results using a cross-encoder model for higher precision.</div>
                    </div>
                    <Switch 
                      checked={config.rerank_enabled}
                      onCheckedChange={(v) => setConfig({...config, rerank_enabled: v})}
                    />
                  </div>

                  {config.rerank_enabled && (
                    <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Top K</Label>
                          <span className="text-sm text-muted-foreground">{config.top_k}</span>
                        </div>
                        <Slider 
                          value={[config.top_k]} 
                          min={1} 
                          max={20} 
                          step={1}
                          onValueChange={([v]) => setConfig({...config, top_k: v})}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Score Threshold</Label>
                          <span className="text-sm text-muted-foreground">{config.score_threshold}</span>
                        </div>
                        <Slider 
                          value={[config.score_threshold]} 
                          min={0} 
                          max={1} 
                          step={0.05}
                          onValueChange={([v]) => setConfig({...config, score_threshold: v})}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Recall Test</CardTitle>
              <CardDescription>Test your retrieval configuration with sample queries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter a query to test retrieval..." 
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
                <Button onClick={handleRecallTest} disabled={testing}>
                  {testing ? 'Testing...' : 'Test'}
                </Button>
              </div>

              <div className="space-y-4">
                {testResults.map((result, idx) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-primary">Result #{idx + 1}</div>
                      <div className="text-xs bg-secondary px-2 py-1 rounded">Score: {result.score}</div>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.content}</p>
                  </div>
                ))}
                {testResults.length === 0 && !testing && (
                  <div className="text-center text-muted-foreground py-8">
                    Enter a query above to see retrieval results.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeBase;
