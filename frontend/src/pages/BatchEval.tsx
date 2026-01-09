import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download } from "lucide-react";

export default function BatchEval() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/admin/eval/batch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error("Evaluation failed");
      
      // Download the result file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "eval_result.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("批量评测完成，结果已下载");
    } catch (error) {
      toast.error("批量评测失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">批量评测</h1>

      <Card>
        <CardHeader>
          <CardTitle>运行批量评测</CardTitle>
          <CardDescription>
            上传包含测试用例的 Excel 文件。系统将处理每个用例并生成报告。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed border-white/10 rounded-lg p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium">上传测试用例</h3>
              <p className="text-sm text-muted-foreground mt-1">
                支持格式: .xlsx
              </p>
              <Button variant="link" className="text-sm h-auto p-0 mt-2" onClick={() => window.open("/api/v1/templates/batch-eval", "_blank")}>
                <Download className="w-3 h-3 mr-1" />
                下载模板
              </Button>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <Input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleUpload}
                  disabled={uploading}
                  accept=".xlsx"
                />
                <Button disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "处理中..." : "选择文件"}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">模板格式说明</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Excel 文件应包含以下列：
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>query</strong>: 用户输入的文本</li>
              <li><strong>expected_intent</strong>: (可选) 预期的意图名称</li>
              <li><strong>expected_slots</strong>: (可选) 预期槽位的 JSON 字符串</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
