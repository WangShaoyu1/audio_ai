import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Terminal, Trash2, RefreshCw, Download } from "lucide-react";

interface Instruction {
  id: string;
  name: string;
  description: string;
  parameters: any;
  is_active: boolean;
}

export default function Instructions() {
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
      toast.error("加载指令失败");
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
        toast.error("JSON 参数格式错误");
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
      
      toast.success("指令创建成功");
      setOpen(false);
      setNewInstruction({ name: "", description: "", parameters: "{}" });
      fetchInstructions();
    } catch (error) {
      toast.error("创建指令失败");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">指令管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/api/v1/templates/instructions", "_blank")}>
            <Download className="w-4 h-4 mr-2" />
            下载模板
          </Button>
          <Button variant="outline" onClick={fetchInstructions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                新建指令
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新指令</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名称</Label>
                  <Input
                    id="name"
                    value={newInstruction.name}
                    onChange={(e) => setNewInstruction({ ...newInstruction, name: e.target.value })}
                    placeholder="例如: start_cooking"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={newInstruction.description}
                    onChange={(e) => setNewInstruction({ ...newInstruction, description: e.target.value })}
                    placeholder="该指令的功能描述"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parameters">参数 (JSON)</Label>
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
                <Button onClick={handleCreate}>创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已定义指令</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>参数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    暂无指令，请创建。
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
