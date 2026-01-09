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

      toast.success("Batch evaluation completed and result downloaded");
    } catch (error) {
      toast.error("Failed to run batch evaluation");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Batch Evaluation</h1>

      <Card>
        <CardHeader>
          <CardTitle>Run Batch Evaluation</CardTitle>
          <CardDescription>
            Upload an Excel file containing test cases. The system will process each case and generate a report.
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
              <h3 className="text-lg font-medium">Upload Test Cases</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Supported format: .xlsx
              </p>
              <Button variant="link" className="text-sm h-auto p-0 mt-2" onClick={() => window.open("/api/v1/templates/batch-eval", "_blank")}>
                <Download className="w-3 h-3 mr-1" />
                Download Template
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
                  {uploading ? "Processing..." : "Select File"}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Template Format</h4>
            <p className="text-sm text-muted-foreground mb-2">
              The Excel file should have the following columns:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>query</strong>: The user input text</li>
              <li><strong>expected_intent</strong>: (Optional) The expected intent name</li>
              <li><strong>expected_slots</strong>: (Optional) JSON string of expected slots</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
