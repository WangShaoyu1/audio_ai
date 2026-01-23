import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Input, Table, Modal, message, theme, Upload as AntUpload } from "antd";
import { PlusOutlined, ReloadOutlined, UploadOutlined, CloudUploadOutlined, DeleteOutlined, CopyOutlined, CheckOutlined, DownOutlined, UpOutlined, CodeOutlined } from "@ant-design/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { UploadProps } from 'antd';

const { TextArea } = Input;

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
      type="text"
      size="small"
      icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
      onClick={handleCopy}
      style={{ position: 'absolute', top: 4, right: 4 }}
    />
  );
}

function JsonParameterDisplay({ data }: { data: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { token } = theme.useToken();
  const jsonString = JSON.stringify(data, null, 2);
  const compactString = JSON.stringify(data);

  if (!isExpanded) {
    return (
      <div 
        style={{ 
          cursor: 'pointer', 
          border: `1px dashed ${token.colorBorder}`, 
          padding: '8px', 
          borderRadius: token.borderRadius,
          color: token.colorTextSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 400
        }}
        onClick={() => setIsExpanded(true)}
        title="Click to expand"
      >
        <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{compactString}</span>
        <DownOutlined style={{ fontSize: 12, marginLeft: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', borderRadius: token.borderRadius, border: `1px solid ${token.colorBorder}`, background: token.colorFillAlter }}>
      <div 
        style={{ 
          position: 'absolute', 
          top: 4, 
          right: 32, 
          zIndex: 10, 
          cursor: 'pointer',
          padding: 4
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(false);
        }}
        title="Collapse"
      >
        <UpOutlined style={{ fontSize: 12 }} /> 
      </div>
      <div style={{ maxHeight: 150, overflowY: 'auto', padding: 12, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {jsonString}
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
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [newInstruction, setNewInstruction] = useState({
    name: "",
    description: "",
    parameters: "{}"
  });

  const [searchQuery, setSearchQuery] = useState("");

  const fetchInstructions = async (currentPage = page, currentPageSize = pageSize, query = searchQuery) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = new URL("/api/v1/admin/instructions", window.location.origin);
      url.searchParams.append("page", currentPage.toString());
      url.searchParams.append("page_size", currentPageSize.toString());
      if (query) {
        url.searchParams.append("q", query);
      }

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch instructions");
      const data = await response.json();
      setInstructions(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      message.error(t("instructions.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions(page, pageSize);
  }, [page, pageSize]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    fetchInstructions(1, pageSize, value);
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
        message.success(t("instructions.importSuccess"));
        setUploadDialogOpen(false);
        setSelectedFile(null);
        fetchInstructions();
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      message.error(t("instructions.importError"));
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem("token");
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(newInstruction.parameters);
      } catch (e) {
        message.error(t("instructions.jsonError"));
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
      
      message.success(t("instructions.createSuccess"));
      setOpen(false);
      setNewInstruction({ name: "", description: "", parameters: "{}" });
      fetchInstructions();
    } catch (error) {
      message.error(t("instructions.createError"));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t("common.delete"),
      content: t("instructions.deleteConfirm"),
      okText: t("common.confirm"),
      cancelText: t("common.cancel"),
      okType: 'danger',
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch(`/api/v1/admin/instructions/${id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            message.success(t("common.success"));
            fetchInstructions();
          } else {
            throw new Error("Failed to delete");
          }
        } catch (error) {
          message.error(t("common.error"));
        }
      }
    });
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      setSelectedFile(file);
      return false;
    },
    onRemove: () => {
      setSelectedFile(null);
    },
    fileList: selectedFile ? [selectedFile as any] : [],
    maxCount: 1,
    accept: ".xlsx,.xls,.csv"
  };

  const columns = [
    {
      title: t("instructions.colName"),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CodeOutlined style={{ color: '#722ed1' }} />
          <span style={{ wordBreak: 'break-all' }}>{text}</span>
        </div>
      ),
    },
    {
      title: t("instructions.colDesc"),
      dataIndex: 'description',
      key: 'description',
      width: 500,
      render: (text: string) => (
        <div style={{ maxHeight: 150, overflowY: 'auto', whiteSpace: 'normal', wordBreak: 'break-word' }}>
          {text}
        </div>
      ),
    },
    {
      title: t("instructions.colParams"),
      dataIndex: 'parameters',
      key: 'parameters',
      width: 400,
      render: (params: any) => <JsonParameterDisplay data={params} />,
    },
    {
      title: t("instructions.colActions"),
      key: 'actions',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: Instruction) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleDelete(record.id)}
        />
      ),
    },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{t("instructions.title")}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input.Search
              placeholder={t("home.searchPlaceholder")}
              onSearch={handleSearch}
              style={{ width: 200 }}
              allowClear
            />
            <Button onClick={() => setUploadDialogOpen(true)} icon={<UploadOutlined />}>
              {t("instructions.importBtn")}
            </Button>

            <Button onClick={() => fetchInstructions()} disabled={loading} icon={<ReloadOutlined spin={loading} />}>
              {t("kb.refresh")}
            </Button>
            
            <Button type="primary" onClick={() => setOpen(true)} icon={<PlusOutlined />}>
              {t("instructions.createBtn")}
            </Button>
            
            <LanguageToggle />
          </div>
        </div>

        <Card title={t("instructions.listTitle")}>
          <Table
            dataSource={instructions}
            columns={columns}
            rowKey="id"
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
              showSizeChanger: true
            }}
            locale={{ emptyText: t("instructions.noData") }}
          />
        </Card>

        {/* Create Dialog */}
        <Modal
          title={t("instructions.createDialogTitle")}
          open={open}
          onCancel={() => setOpen(false)}
          onOk={handleCreate}
          okText={t("instructions.btnCreate")}
          cancelText={t("home.cancel")}
          maskClosable={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
            <div>
              <div style={{ marginBottom: 8 }}>{t("instructions.labelName")}</div>
              <Input
                value={newInstruction.name}
                onChange={(e) => setNewInstruction({ ...newInstruction, name: e.target.value })}
                placeholder={t("instructions.placeholderName")}
              />
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>{t("instructions.labelDesc")}</div>
              <TextArea
                value={newInstruction.description}
                onChange={(e) => setNewInstruction({ ...newInstruction, description: e.target.value })}
                placeholder={t("instructions.placeholderDesc")}
                rows={4}
              />
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>{t("instructions.labelParams")}</div>
              <TextArea
                value={newInstruction.parameters}
                onChange={(e) => setNewInstruction({ ...newInstruction, parameters: e.target.value })}
                placeholder="{}"
                rows={4}
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>
        </Modal>

        {/* Upload Dialog */}
        <Modal
          title={t("instructions.batchImportTitle")}
          open={uploadDialogOpen}
          onCancel={() => setUploadDialogOpen(false)}
          onOk={handleUpload}
          okText={t("home.confirm")}
          cancelText={t("home.cancel")}
          okButtonProps={{ disabled: !selectedFile }}
          maskClosable={false}
        >
          <div style={{ padding: '24px 0' }}>
            <AntUpload.Dragger {...uploadProps} showUploadList={false}>
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text">
                {selectedFile ? selectedFile.name : t("instructions.uploadFile")}
              </p>
            </AntUpload.Dragger>

            <div style={{ marginTop: 24, fontSize: 14, color: 'rgba(0, 0, 0, 0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span>{t("instructions.uploadStep1")}</span>
                <span>(</span>
                <span 
                  style={{ color: '#1677ff', cursor: 'pointer' }}
                  onClick={() => window.open("/api/v1/templates/instructions", "_blank")}
                >
                  {t("batchEval.downloadTemplate")}
                </span>
                <span>)</span>
              </div>
              <div>{t("instructions.uploadStep2")}</div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
