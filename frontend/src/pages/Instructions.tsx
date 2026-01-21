import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Terminal, Trash2, RefreshCw, Upload, UploadCloud, ChevronLeft, ChevronRight, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 absolute top-2 right-2 text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
      onClick={handleCopy}
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

function JsonParameterDisplay({ data }: { data: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);
  const compactString = JSON.stringify(data);

  if (!isExpanded) {
    return (
      <div 
        className="w-[400px] cursor-pointer rounded-md border border-dashed p-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-between group"
        onClick={() => setIsExpanded(true)}
        title="Click to expand"
      >
        <span className="font-mono truncate">{compactString}</span>
        <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
      </div>
    );
  }

  return (
    <div className="relative rounded-md border bg-muted/50 group">
      <div 
        className="absolute top-2 right-8 z-10 cursor-pointer p-1 text-muted-foreground hover:text-foreground rounded-sm hover:bg-background/50 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(false);
        }}
        title="Collapse"
      >
        <ChevronUp className="w-3 h-3" /> 
      </div>
      <div className="max-h-[150px] overflow-y-auto p-3 font-mono text-xs">
        <pre className="whitespace-pre-wrap break-words">
          {jsonString}
        </pre>
      </div>
      <CopyButton text={jsonString} />
    </div>
  );
}

interface Instruction {
  id: string;
  name: string;
  description: string;
  parameters: any;
  is_active: boolean;
}

export default function Instructions() {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [newInstruction, setNewInstruction] = useState({
    name: "",
    description: "",
    parameters: "{}"
  });

  const fetchInstructions = async (currentPage = page) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/admin/instructions?page=${currentPage}&page_size=${pageSize}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch instructions");
      const data = await response.json();
      setInstructions(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(t("instructions.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, [page]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / pageSize)) {
      setPage(newPage);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/admin/instructions/import", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      if (response.ok) {
        toast.success(t("instructions.importSuccess"));
        setUploadDialogOpen(false);
        fetchInstructions();
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      toast.error(t("instructions.importError"));
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem("token");
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(newInstruction.parameters);
      } catch (e) {
        toast.error(t("instructions.jsonError"));
        return;
      }

      const response = await fetch("/api/v1/admin/instructions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newInstruction.name,
          description: newInstruction.description,
          parameters: parsedParams
        })
      });

      if (!response.ok) throw new Error("Failed to create instruction");
      
      toast.success(t("instructions.createSuccess"));
      setOpen(false);
      setNewInstruction({ name: "", description: "", parameters: "{}" });
      fetchInstructions();
    } catch (error) {
      toast.error(t("instructions.createError"));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("instructions.title")}</h1>
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            {t("instructions.importBtn")}
          </Button>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent className="sm:max-w-[512px]">
              <DialogHeader>
                <DialogTitle>{t("instructions.batchImportTitle")}</DialogTitle>
              </DialogHeader>
              
              <div className="py-6">
                <div 
                  className="border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 rounded-lg h-[200px] flex flex-col items-center justify-center cursor-pointer transition-all group"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                  />
                  <UploadCloud className="w-16 h-16 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors mb-4" />
                  <span className="text-blue-500 font-medium">{selectedFile ? selectedFile.name : t("instructions.uploadFile")}</span>
                </div>

                <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center flex-wrap gap-1">
                    <span>{t("instructions.uploadStep1")}</span>
                    <span>(</span>
                    <span 
                      className="text-blue-500 hover:underline cursor-pointer"
                      onClick={() => window.open("/api/v1/templates/instructions", "_blank")}
                    >
                      {t("batchEval.downloadTemplate")}
                    </span>
                    <span>)</span>
                  </div>
                  <div>{t("instructions.uploadStep2")}</div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>{t("home.cancel")}</Button>
                <Button onClick={handleUpload} disabled={!selectedFile}>
                  {t("home.confirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => fetchInstructions()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("kb.refresh")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("instructions.createBtn")}
              </Button>
            </DialogTrigger>
            <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{t("instructions.createDialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("instructions.labelName")}</Label>
                  <Input
                    id="name"
                    value={newInstruction.name}
                    onChange={(e) => setNewInstruction({ ...newInstruction, name: e.target.value })}
                    placeholder={t("instructions.placeholderName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t("instructions.labelDesc")}</Label>
                  <Textarea
                    id="description"
                    value={newInstruction.description}
                    onChange={(e) => setNewInstruction({ ...newInstruction, description: e.target.value })}
                    placeholder={t("instructions.placeholderDesc")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parameters">{t("instructions.labelParams")}</Label>
                  <Textarea
                    id="parameters"
                    value={newInstruction.parameters}
                    onChange={(e) => setNewInstruction({ ...newInstruction, parameters: e.target.value })}
                    placeholder="{}"
                    className="font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("home.cancel")}</Button>
                <Button onClick={handleCreate}>{t("instructions.btnCreate")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <LanguageToggle />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("instructions.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">{t("instructions.colName")}</TableHead>
                  <TableHead className="max-w-[500px]">{t("instructions.colDesc")}</TableHead>
                  <TableHead className="w-[400px]">{t("instructions.colParams")}</TableHead>
                  <TableHead className="text-right w-[100px]">{t("instructions.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t("instructions.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  instructions.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium align-top">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-purple-500 shrink-0" />
                          <span className="break-all">{inst.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="max-h-[150px] overflow-y-auto pr-2 whitespace-normal break-words">
                          {inst.description}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <JsonParameterDisplay data={inst.parameters} />
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/20">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              {total > 0 ? (
                <span>
                  {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}
                </span>
              ) : (
                <span>0 of 0</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= Math.ceil(total / pageSize) || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
