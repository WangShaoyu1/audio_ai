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
import { Plus, Terminal, Trash2, RefreshCw, Download } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

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
  const [newInstruction, setNewInstruction] = useState({
    name: "",
    description: "",
    parameters: "{}"
  });

  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/admin/instructions", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch instructions");
      const data = await response.json();
      setInstructions(data);
    } catch (error) {
      toast.error(t("instructions.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, []);

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("instructions.title")}</h1>
        <div className="flex gap-2 items-center">
          <LanguageToggle />
          <Button variant="outline" onClick={() => window.open("/api/v1/templates/instructions", "_blank")}>
            <Download className="w-4 h-4 mr-2" />
            {t("batchEval.downloadTemplate")}
          </Button>
          <Button variant="outline" onClick={fetchInstructions} disabled={loading}>
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
            <DialogContent>
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
                <Button onClick={handleCreate}>{t("instructions.btnCreate")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("instructions.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("instructions.colName")}</TableHead>
                <TableHead>{t("instructions.colDesc")}</TableHead>
                <TableHead>{t("instructions.colParams")}</TableHead>
                <TableHead className="text-right">{t("instructions.colActions")}</TableHead>
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
                    <TableCell className="font-medium flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-purple-500" />
                      {inst.name}
                    </TableCell>
                    <TableCell>{inst.description}</TableCell>
                    <TableCell>
                      <pre className="text-xs bg-muted p-2 rounded max-w-[200px] overflow-hidden text-ellipsis">
                        {JSON.stringify(inst.parameters, null, 2)}
                      </pre>
                    </TableCell>
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
    </div>
  );
}
