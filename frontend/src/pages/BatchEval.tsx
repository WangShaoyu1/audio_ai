import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Upload, message, Typography, theme } from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { UploadProps } from 'antd';

const { Dragger } = Upload;
const { Title, Text } = Typography;

export default function BatchEval() {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const { token } = theme.useToken();

  const handleUpload = async (file: File) => {
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

      message.success(t("batchEval.success"));
    } catch (error) {
      message.error(t("batchEval.error"));
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    accept: ".xlsx",
    customRequest: ({ file }) => {
      handleUpload(file as File);
    },
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>{t("batchEval.title")}</Title>
        <LanguageToggle />
      </div>

      <Card title={t("batchEval.runTitle")}>
        <div style={{ marginBottom: 24 }}>
          <Text type="secondary">{t("batchEval.runDesc")}</Text>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Dragger {...uploadProps} disabled={uploading} style={{ padding: 48, background: token.colorFillAlter, border: `1px dashed ${token.colorBorder}` }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: token.colorPrimary }} />
              </p>
              <p className="ant-upload-text">{t("batchEval.uploadTitle")}</p>
              <p className="ant-upload-hint">
                {t("batchEval.uploadFormat")}
              </p>
            </Dragger>

            <div style={{ marginTop: 16 }}>
               <Button type="link" icon={<DownloadOutlined />} onClick={() => window.open("/api/v1/templates/batch-eval", "_blank")}>
                {t("batchEval.downloadTemplate")}
              </Button>
            </div>
          </div>

          <div style={{ background: token.colorFillTertiary, padding: 16, borderRadius: token.borderRadius }}>
            <Title level={5} style={{ marginTop: 0 }}>{t("batchEval.templateFormat")}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t("batchEval.templateDesc")}
            </Text>
            <ul style={{ paddingLeft: 20, margin: 0, color: token.colorTextSecondary }}>
              <li><Text strong>query</Text>: {t("batchEval.colQuery")}</li>
              <li><Text strong>expected_intent</Text>: {t("batchEval.colIntent")}</li>
              <li><Text strong>expected_slots</Text>: {t("batchEval.colSlots")}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
