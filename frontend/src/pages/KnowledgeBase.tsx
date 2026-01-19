import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileText, Trash2, RefreshCw, Search, Settings } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { LanguageToggle } from "@/components/LanguageToggle";

interface Document {
  id: string;
  filename: string;
  status: string;
  created_at: string;
}

export default function KnowledgeBase() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Recall Test State
  const [query, setQuery] = useState("");
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/admin/documents", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      toast.error(t("kb.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

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
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/admin/documents/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success("文档上传成功");
      fetchDocuments();
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("文档上传失败");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
      e.target.value = "";
    }
  };

  const handleRecallTest = async () => {
    if (!query.trim()) return;
    setTesting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/admin/rag/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ query, top_k: 3 })
      });
      
      if (!response.ok) throw new Error("Test failed");
      const data = await response.json();
      setTestResults(data.results);
    } catch (error) {
      toast.error(t("kb.testError"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("kb.title")}</h1>
        <LanguageToggle />
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            {t("kb.tabDocs")}
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            {t("kb.tabSettings")}
          </TabsTrigger>
          <TabsTrigger value="test">
            <Search className="w-4 h-4 mr-2" />
            {t("kb.tabTest")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={fetchDocuments} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {t("kb.refresh")}
            </Button>
            <div className="relative">
              <Input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleUpload}
                disabled={uploading}
                accept=".txt,.pdf,.md"
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
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("kb.colFilename")}</TableHead>
                    <TableHead>{t("kb.colStatus")}</TableHead>
                    <TableHead>{t("kb.colDate")}</TableHead>
                    <TableHead className="text-right">{t("kb.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {t("kb.noDocs")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          {doc.filename}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            doc.status === 'indexed' ? 'bg-green-500/20 text-green-400' : 
                            doc.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' : 
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {doc.status === 'indexed' ? t("kb.statusIndexed") : 
                             doc.status === 'processing' ? t("kb.statusProcessing") : t("kb.statusFailed")}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/20">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{t("kb.ragConfigTitle")}</CardTitle>
              <CardDescription>{t("kb.ragConfigDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground text-sm">
                {t("kb.settingsDev")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("kb.tabTest")}</CardTitle>
              <CardDescription>{t("kb.testDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder={t("kb.testPlaceholder")} 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecallTest()}
                />
                <Button onClick={handleRecallTest} disabled={testing}>
                  {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {t("kb.testBtn")}
                </Button>
              </div>

              {testResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">{t("kb.testResults")}</h3>
                  {testResults.map((result, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50 text-sm">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
