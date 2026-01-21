import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileText, Trash2, RefreshCw, Search, Settings, Save, Database, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
// @ts-ignore
import { api } from "@/lib/api";

interface Document {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  provider?: string;
  model?: string;
  is_configured: boolean;
}

interface RAGConfig {
  index_mode: string;
  retrieval_mode: string;
  rerank_enabled: boolean;
  rerank_model: string;
  top_k: number;
  score_threshold: number;
}

interface TestRecord {
  id: string;
  query: string;
  results: any[];
  created_at: string;
}

export default function KnowledgeBase() {
  const { t } = useTranslation();
  
  // View State
  const [view, setView] = useState<'list' | 'test'>('list');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // Document List State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // RAG Config State
  const [ragConfig, setRagConfig] = useState<RAGConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Recall Test State
  const [query, setQuery] = useState("");
  const [testing, setTesting] = useState(false);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestRecord | null>(null);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  // Index State
  const [indexId, setIndexId] = useState<string | null>(null);
  const [indexProvider, setIndexProvider] = useState("openai");
  const [indexModel, setIndexModel] = useState("text-embedding-3-small");
  const [indexing, setIndexing] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    if (indexProvider === 'ollama') {
      api.get('/admin/ollama/models')
        .then((data: any) => {
             if (data.models && Array.isArray(data.models)) {
                 setOllamaModels(data.models);
             }
        })
        .catch((err: any) => {
            console.error("Failed to fetch Ollama models", err);
            // Fallback to default list if fetch fails is handled in render
        });
    }
  }, [indexProvider]);

  const fetchDocuments = async (pageNum = 1) => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/documents?page=${pageNum}&page_size=${pageSize}`);
      setDocuments(data.items);
      setTotalPages(data.pages);
      setPage(data.page);
    } catch (error) {
      toast.error(t("kb.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const data = await api.get("/admin/rag/config");
      setRagConfig(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTestHistory = async (docId?: string) => {
    try {
      const url = docId ? `/admin/rag/tests?doc_id=${docId}` : "/admin/rag/tests";
      const data = await api.get(url);
      setTestHistory(data);
      if (data.length > 0) {
        setSelectedTest(data[0]);
      } else {
        setSelectedTest(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchConfig();
    // fetchTestHistory(); // Don't fetch global history on mount anymore
  }, []);

  const handlePreview = async (doc: Document) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const response = await api.get(`/admin/documents/${doc.id}`);
      setPreviewContent(response.content || t("kb.noContent"));
    } catch (error) {
      console.error(error);
      toast.error(t("kb.previewError"));
      setPreviewContent(t("kb.previewError"));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    
    // Simulate progress since fetch doesn't support upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response: any = await api.upload("/admin/documents/upload", formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response && response.status === 'failed') {
        toast.error(t("kb.uploadFailed") + ": " + (response.error_msg || "Unknown error"));
      } else {
        toast.success(t("kb.uploadSuccess"));
      }

      fetchDocuments(1);
    } catch (error) {
      clearInterval(progressInterval);
      toast.error(t("kb.uploadError"));
      fetchDocuments(page);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
      e.target.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/documents/${deleteId}`);
      toast.success(t("kb.docDeleted"));
      fetchDocuments(page);
    } catch (error) {
      toast.error("Failed to delete document");
    } finally {
      setDeleteId(null);
    }
  };

  const confirmIndex = async () => {
    if (!indexId) return;
    setIndexing(true);
    try {
      await api.post(`/admin/documents/${indexId}/index`, {
        provider: indexProvider,
        model: indexModel
      });
      toast.success(t("kb.indexingSuccess"));
      fetchDocuments(page);
    } catch (error) {
      toast.error(t("kb.indexingError"));
    } finally {
      setIndexing(false);
      setIndexId(null);
    }
  };

  const openConfig = (doc: Document) => {
    setSelectedDoc(doc);
    setConfigOpen(true);
  };

  const saveConfig = async () => {
    if (!ragConfig || !selectedDoc) return;
    setSavingConfig(true);
    try {
      // 1. Save global config
      await api.put("/admin/rag/config", ragConfig);

      // 2. Update document config status
      await api.put(`/admin/documents/${selectedDoc.id}/config_status?is_configured=true`, {});

      toast.success(t("kb.configSaved"));
      setConfigOpen(false);
      fetchDocuments(page);
    } catch (e) {
      toast.error(t("kb.configSaveError"));
    } finally {
      setSavingConfig(false);
    }
  };

  const openTest = (doc: Document) => {
    setSelectedDoc(doc);
    setView('test');
    // Clear previous test state
    setQuery("");
    setTestHistory([]);
    setSelectedTest(null);
    // Fetch test history specific to this doc
    fetchTestHistory(doc.id); 
  };

  const handleRecallTest = async () => {
    if (!query.trim()) return;
    setTesting(true);
    try {
      const body: any = { 
        query, 
        top_k: ragConfig?.top_k || 3 
      };
      if (selectedDoc) {
        body.doc_id = selectedDoc.id;
      }

      const data = await api.post("/admin/rag/retrieve", body);
      
      const newRecord: TestRecord = {
        id: Date.now().toString(),
        query: query,
        results: data.results,
        created_at: new Date().toISOString()
      };
      
      setTestHistory(prev => [newRecord, ...prev]);
      setSelectedTest(newRecord);
      setQuery("");
      
    } catch (error) {
      toast.error(t("kb.testError"));
    } finally {
      setTesting(false);
    }
  };

  // Render Recall Test View
  if (view === 'test' && selectedDoc) {
    return (
      <div className="container mx-auto p-6 space-y-6 h-[calc(100vh-100px)] flex flex-col">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setView('list')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("kb.back")}
            </Button>
            <h1 className="text-2xl font-bold">{t("kb.tabTest")}: {selectedDoc.filename}</h1>
          </div>
          <LanguageToggle />
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left Panel: Chat Interface */}
          <Card className="flex-1 flex flex-col w-1/3">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">{t("kb.testHistory")}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 bg-muted/10 relative">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-6">
                  {testHistory.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      {t("kb.testNoHistory")}
                    </div>
                  ) : (
                    [...testHistory].reverse().map((test) => (
                      <div key={test.id} className="space-y-4">
                         {/* User Query Bubble */}
                         <div className="flex justify-end">
                           <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-tr-sm max-w-[90%] text-sm shadow-sm">
                             {test.query}
                           </div>
                         </div>

                         {/* System Response Bubble */}
                         <div className="flex justify-start">
                           <div
                             className={`px-4 py-3 rounded-2xl rounded-tl-sm max-w-[90%] text-sm cursor-pointer border transition-all shadow-sm hover:shadow-md ${
                               selectedTest?.id === test.id
                               ? "bg-background border-primary ring-1 ring-primary"
                               : "bg-background hover:bg-muted/50"
                             }`}
                             onClick={() => setSelectedTest(test)}
                           >
                             <div className="font-medium mb-1 flex items-center gap-2">
                               <CheckCircle2 className="w-4 h-4 text-green-500" />
                               {t("kb.testResults")} ({test.results?.length || 0})
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {new Date(test.created_at).toLocaleTimeString()}
                             </div>
                           </div>
                         </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Input
                  placeholder={t("kb.testPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecallTest()}
                  disabled={testing}
                  className="flex-1"
                />
                <Button onClick={handleRecallTest} disabled={testing}>
                   {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </Card>

          {/* Right Panel: Details */}
          <Card className="flex-1 w-2/3 flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/5">
              <CardTitle className="text-lg">{t("kb.testDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <ScrollArea className="h-full">
                {selectedTest ? (
                  <div className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{t("kb.testQuery")}</h3>
                      <div className="p-3 bg-muted rounded-md text-sm">{selectedTest.query}</div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground">{t("kb.testResults")}</h3>
                      {selectedTest.results?.map((result: any, i: number) => (
                        <Card key={i} className="border-l-4 border-l-primary shadow-sm">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <Badge variant="outline" className="font-mono">
                                Score: {(result.score * 100).toFixed(1)}%
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Chunk {result.chunk_index}
                              </span>
                            </div>
                            <div className="text-sm leading-relaxed">
                              {result.content}
                            </div>
                            {result.metadata && (
                              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                {JSON.stringify(result.metadata, null, 2)}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Search className="w-12 h-12 mb-4 opacity-20" />
                    <p>{t("kb.testSelectPlaceholder")}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render Document List View
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("kb.title")}</h1>
        <LanguageToggle />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => fetchDocuments(page)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("kb.refresh")}
        </Button>
        <div className="relative">
          <Input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleUpload}
            disabled={uploading}
            accept=".txt,.pdf,.md,.docx,.xlsx,.pptx"
          />
          <Button disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? t("kb.uploading") : t("kb.upload")}
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="w-full space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("kb.uploadProgress")}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("kb.tabDocs")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("kb.colFilename")}</TableHead>
                <TableHead>{t("kb.headerIndexStatus")}</TableHead>
                <TableHead>{t("kb.headerRagStatus")}</TableHead>
                <TableHead>{t("kb.colDate")}</TableHead>
                <TableHead className="text-right">{t("kb.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("kb.noDocs")}
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div className="flex flex-col">
                        <Button 
                          variant="link" 
                          className="p-0 h-auto font-medium justify-start text-foreground hover:text-primary"
                          onClick={() => handlePreview(doc)}
                        >
                          {doc.filename}
                        </Button>
                        {doc.provider && (
                          <span className="text-xs text-muted-foreground">{doc.provider}/{doc.model}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        doc.status === 'indexed' ? 'default' : 
                        doc.status === 'processing' ? 'secondary' : 
                        doc.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {doc.status === 'indexed' ? t("kb.statusIndexed") : 
                         doc.status === 'processing' ? t("kb.statusProcessing") : 
                         doc.status === 'failed' ? t("kb.statusFailed") :
                         t("kb.statusIndexUnindexed")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <Badge variant={doc.is_configured ? 'default' : 'secondary'}>
                         {doc.is_configured ? t("kb.statusConfigured") : t("kb.statusUnconfigured")}
                       </Badge>
                    </TableCell>
                    <TableCell>{new Date(doc.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIndexId(doc.id)}
                        disabled={doc.status === 'processing' || doc.status === 'failed'}
                      >
                        <Database className="w-3 h-3 mr-1" />
                        {t("kb.manualIndex")}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openConfig(doc)}
                        disabled={doc.status !== 'indexed'}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        {t("kb.actionConfig")}
                      </Button>

                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openTest(doc)}
                        disabled={!doc.is_configured || doc.status === 'failed'}
                      >
                        <Search className="w-3 h-3 mr-1" />
                        {t("kb.actionTest")}
                      </Button>

                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => page > 1 && fetchDocuments(page - 1)}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink 
                    isActive={p === page}
                    onClick={() => fetchDocuments(p)}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => page < totalPages && fetchDocuments(page + 1)}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      {/* RAG Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("kb.ragConfigTitle")} - {selectedDoc?.filename}</DialogTitle>
            <DialogDescription>{t("kb.ragConfigDesc")}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {ragConfig ? (
              <>
                <div className="space-y-2">
                  <Label>{t("kb.retrievalMode")}</Label>
                  <Select 
                    value={ragConfig.retrieval_mode} 
                    onValueChange={(val) => setRagConfig({...ragConfig, retrieval_mode: val})}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vector">{t("kb.modeVector")}</SelectItem>
                      <SelectItem value="full_text">{t("kb.modeKeyword")}</SelectItem>
                      <SelectItem value="hybrid">{t("kb.modeHybrid")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("kb.rerankEnabled")}</Label>
                    <div className="text-sm text-muted-foreground">
                      {t("kb.rerankDesc")}
                    </div>
                  </div>
                  <Switch 
                    checked={ragConfig.rerank_enabled}
                    onCheckedChange={(checked) => setRagConfig({...ragConfig, rerank_enabled: checked})}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label>{t("kb.topK")}: {ragConfig.top_k}</Label>
                  </div>
                  <Slider 
                    value={[ragConfig.top_k]} 
                    min={1} 
                    max={20} 
                    step={1} 
                    onValueChange={(vals) => setRagConfig({...ragConfig, top_k: vals[0]})}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label>{t("kb.scoreThreshold")}: {ragConfig.score_threshold}</Label>
                  </div>
                  <Slider 
                    value={[ragConfig.score_threshold]} 
                    min={0} 
                    max={1} 
                    step={0.05} 
                    onValueChange={(vals) => setRagConfig({...ragConfig, score_threshold: vals[0]})}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-4">{t("common.loading")}</div>
            )}
          </div>

          <DialogFooter>
             <Button variant="outline" onClick={() => setConfigOpen(false)}>{t("kb.cancel")}</Button>
             <Button onClick={saveConfig} disabled={savingConfig}>
              <Save className="w-4 h-4 mr-2" />
              {savingConfig ? "Saving..." : t("kb.saveConfig")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("kb.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("kb.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("kb.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              {t("kb.deleteConfirmTitle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Index Dialog */}
      <Dialog open={!!indexId} onOpenChange={(open) => !open && setIndexId(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("kb.manualIndex")}</DialogTitle>
            <DialogDescription>
              {t("kb.indexDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("kb.provider")}</Label>
              <Select value={indexProvider} onValueChange={setIndexProvider}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("kb.model")}</Label>
              <Select value={indexModel} onValueChange={setIndexModel}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {indexProvider === 'openai' ? (
                    <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                  ) : (
                    <>
                      {ollamaModels.length > 0 ? (
                        ollamaModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="nomic-embed-text">nomic-embed-text</SelectItem>
                          <SelectItem value="mxbai-embed-large">mxbai-embed-large</SelectItem>
                          <SelectItem value="bge-large">bge-large</SelectItem>
                          <SelectItem value="llama3">llama3</SelectItem>
                        </>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndexId(null)}>{t("kb.cancel")}</Button>
            <Button onClick={confirmIndex} disabled={indexing}>
              {indexing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              {t("kb.manualIndex")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-7xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              {previewDoc?.filename}
            </DialogTitle>
            <DialogDescription>
              {t("kb.previewDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted/5 relative">
            {previewLoading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewObjectUrl ? (
               (() => {
                const ext = previewDoc?.filename.split('.').pop()?.toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
                  return (
                    <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                      <img src={previewObjectUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-sm" />
                    </div>
                  );
                }
                if (ext === 'pdf') {
                  return (
                    <iframe src={previewObjectUrl} className="w-full h-full border-none" title="PDF Preview" />
                  );
                }
                if (['txt', 'md', 'json', 'log', 'csv'].includes(ext || '')) {
                   return (
                     <ScrollArea className="h-full w-full p-6">
                       <pre className="whitespace-pre-wrap font-mono text-sm">{previewContent}</pre>
                     </ScrollArea>
                   );
                }
                // Fallback
                return (
                  <div className="h-full flex flex-col items-center justify-center gap-4">
                    <div className="text-muted-foreground">
                      Preview not supported for this file type
                    </div>
                    <Button variant="outline" asChild>
                      <a href={previewObjectUrl} download={previewDoc?.filename}>
                        Download File
                      </a>
                    </Button>
                  </div>
                );
              })()
            ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground">
                 {t("kb.previewError")}
               </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t">
            <Button onClick={() => setPreviewOpen(false)}>{t("kb.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
