import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function BatchEval() {
  const { t } = useTranslation();
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

      if (!response.ok) throw new Error(t("batchEval.evalFailed"));
      
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

      toast.success(t("batchEval.success"));
    } catch (error) {
      toast.error(t("batchEval.error"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("batchEval.title")}</h1>
        <LanguageToggle />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("batchEval.runTitle")}</CardTitle>
          <CardDescription>
            {t("batchEval.runDesc")}
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
              <h3 className="text-lg font-medium">{t("batchEval.uploadTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("batchEval.uploadFormat")}
              </p>
              <Button variant="link" className="text-sm h-auto p-0 mt-2" onClick={() => window.open("/api/v1/templates/batch-eval", "_blank")}>
                <Download className="w-3 h-3 mr-1" />
                {t("batchEval.downloadTemplate")}
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
                  {uploading ? t("batchEval.processing") : t("batchEval.selectFile")}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">{t("batchEval.templateFormat")}</h4>
            <p className="text-sm text-muted-foreground mb-2">
              {t("batchEval.templateDesc")}
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>query</strong>: {t("batchEval.colQuery")}</li>
              <li><strong>expected_intent</strong>: {t("batchEval.colIntent")}</li>
              <li><strong>expected_slots</strong>: {t("batchEval.colSlots")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
