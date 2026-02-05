import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Table, Button, Card, Input, Modal, Form, Select,
  Switch, Slider, Progress, Badge, Tooltip, App,
  Upload as AntUpload, Row, Col, List, Typography,
  Space, Empty, Spin, InputNumber, Popconfirm
} from "antd";
import { 
  FileTextOutlined, DeleteOutlined, ReloadOutlined, 
  SearchOutlined, SettingOutlined, 
  DatabaseOutlined, ArrowLeftOutlined, UploadOutlined,
  CheckCircleOutlined, PlayCircleOutlined
} from "@ant-design/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
// @ts-ignore
import { api } from "@/lib/api";
import embeddingModelsConfig from "@/config/embeddingModels.json";

const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface Document {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  provider?: string;
  model?: string;
  is_configured: boolean;
  file_path?: string; 
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
  const { message, modal } = App.useApp();
  
  // View State
  const [view, setView] = useState<'list' | 'test'>('list');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // Document List State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // RAG Config State
  const [ragConfig, setRagConfig] = useState<RAGConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm] = Form.useForm();

  // Index State
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexDocId, setIndexDocId] = useState<string | null>(null);
  const [indexForm] = Form.useForm();
  const [indexing, setIndexing] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);

  // Recall Test State
  const [query, setQuery] = useState("");
  const [testing, setTesting] = useState(false);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestRecord | null>(null);

  // Cleanup Preview URL
  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  // Initial Fetch
  useEffect(() => {
    fetchDocuments(1);
    fetchConfig();
  }, []);

  // Fetch Ollama models when provider changes in Index Form
  const handleIndexProviderChange = async (provider: string) => {
    // Clear model selection when provider changes
    indexForm.setFieldValue('model', undefined);
    if (provider === 'ollama') {
      try {
        const data = await api.get('/admin/ollama/models');
        if (data.models && Array.isArray(data.models)) {
          // Filter models to only show known embedding models
          const knownModels = (embeddingModelsConfig as any).ollama.known_embedding_models || [];
          const filteredModels = data.models.filter((m: string) =>
            knownModels.some((known: string) => m.toLowerCase().includes(known.toLowerCase()))
          );
          setOllamaModels(filteredModels);
        }
      } catch (err) {
        console.error("Failed to fetch Ollama models", err);
      }
    }
  };

  const fetchDocuments = async (pageNum = 1, query = searchQuery) => {
    setLoading(true);
    try {
      const url = new URL("/admin/documents", window.location.origin);
      url.searchParams.append("page", pageNum.toString());
      url.searchParams.append("page_size", pagination.pageSize.toString());
      if (query) {
        url.searchParams.append("keyword", query);
      }
      const data = await api.get(url.toString().replace(window.location.origin, '')); // api.get expects path
      setDocuments(data.items);
      setPagination({
        ...pagination,
        current: data.page,
        total: data.total || data.pages * pagination.pageSize,
      });
    } catch (error) {
      message.error(t("kb.loadError"));
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

  // --- Handlers ---

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => (prev >= 90 ? prev : prev + 10));
    }, 200);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response: any = await api.upload("/admin/documents/upload", formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response && response.status === 'failed') {
        message.error(t("kb.uploadFailed") + ": " + (response.error_msg || "Unknown error"));
      } else {
        message.success(t("kb.uploadSuccess"));
      }

      fetchDocuments(1);
    } catch (error) {
      clearInterval(progressInterval);
      message.error(t("kb.uploadError"));
      fetchDocuments(pagination.current);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      await api.delete(`/admin/documents/${doc.id}`);
      message.success(t("kb.docDeleted"));
      fetchDocuments(pagination.current);
    } catch (error) {
      message.error("Failed to delete document");
    }
  };

  const handlePreview = async (doc: Document) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewContent("");
    
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }

    try {
      // Try to fetch raw file first
      const blob = await api.getFile(`/admin/documents/${doc.id}/file`);
      const url = URL.createObjectURL(blob);
      setPreviewObjectUrl(url);

      // For text-based files, also read content for potential fallback display
      const ext = doc.filename.split('.').pop()?.toLowerCase();
      if (['txt', 'md', 'json', 'log', 'csv'].includes(ext || '')) {
          const text = await blob.text();
          setPreviewContent(text);
      }
    } catch (error) {
      console.error(error);
      // Fallback to text content API if file fetch fails
      try {
        const response = await api.get(`/admin/documents/${doc.id}`);
        setPreviewContent(response.content || t("kb.noContent"));
      } catch (e) {
         message.error(t("kb.previewError"));
         setPreviewContent(t("kb.previewError"));
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenConfig = (doc: Document) => {
    setSelectedDoc(doc);
    if (ragConfig) {
      configForm.setFieldsValue(ragConfig);
    }
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setSavingConfig(true);
      
      // 1. Save global config
      await api.put("/admin/rag/config", values);
      setRagConfig(values);

      // 2. Update document config status
      if (selectedDoc) {
        await api.put(`/admin/documents/${selectedDoc.id}/config_status?is_configured=true`, {});
      }

      message.success(t("kb.configSaved"));
      setConfigOpen(false);
      fetchDocuments(pagination.current);
    } catch (e) {
      message.error(t("kb.configSaveError"));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenIndex = (doc: Document) => {
    setIndexDocId(doc.id);
    indexForm.setFieldsValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      language: 'zh',
      chunk_size: 1000,
      chunk_overlap: 200
    });
    setIndexModalOpen(true);
  };

  const handleIndex = async () => {
    try {
      const values = await indexForm.validateFields();
      if (!indexDocId) return;

      setIndexing(true);
      await api.post(`/admin/documents/${indexDocId}/index`, {
        provider: values.provider,
        model: values.model,
        language: values.language,
        chunk_size: values.chunk_size,
        chunk_overlap: values.chunk_overlap
      });
      message.success(t("kb.indexingSuccess"));
      setIndexModalOpen(false);
      fetchDocuments(pagination.current);
    } catch (error) {
      message.error(t("kb.indexingError"));
    } finally {
      setIndexing(false);
    }
  };

  const handleOpenTest = (doc: Document) => {
    setSelectedDoc(doc);
    setView('test');
    setQuery("");
    setTestHistory([]);
    setSelectedTest(null);
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
      message.error(t("kb.testError"));
    } finally {
      setTesting(false);
    }
  };

  // --- Renderers ---

  const columns = [
    {
      title: t("kb.colFilename"),
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string, record: Document) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Button type="link" onClick={() => handlePreview(record)} style={{ padding: 0 }}>
            {text}
          </Button>
          {record.provider && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.provider}/{record.model}</Text>
          )}
        </Space>
      ),
    },
    {
      title: t("kb.headerIndexStatus"),
      key: 'status',
      render: (_: any, record: Document) => {
        let statusColor = 'default';
        let statusText = t("kb.statusIndexUnindexed");
        
        if (record.status === 'indexed') {
          statusColor = 'success';
          statusText = t("kb.statusIndexed");
        } else if (record.status === 'processing') {
          statusColor = 'processing';
          statusText = t("kb.statusProcessing");
        } else if (record.status === 'failed') {
          statusColor = 'error';
          statusText = t("kb.statusFailed");
        }

        return <Badge status={statusColor as any} text={statusText} />;
      }
    },
    {
      title: t("kb.headerRagStatus"),
      key: 'is_configured',
      render: (_: any, record: Document) => (
        <Badge 
          status={record.is_configured ? 'success' : 'warning'} 
          text={record.is_configured ? t("kb.statusConfigured") : t("kb.statusUnconfigured")} 
        />
      )
    },
    {
      title: t("kb.colDate"),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: t("kb.colActions"),
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: Document) => (
        <Space>
          <Tooltip title={t("kb.tooltipIndex")}>
            <Button 
              icon={<DatabaseOutlined />} 
              size="small" 
              onClick={() => handleOpenIndex(record)}
            />
          </Tooltip>
          <Tooltip title={t("kb.tooltipConfig")}>
            <Button 
              icon={<SettingOutlined />} 
              size="small" 
              onClick={() => handleOpenConfig(record)} 
              disabled={record.status !== 'indexed'}
            />
          </Tooltip>
          <Tooltip title={t("kb.tooltipTest")}>
            <Button 
              icon={<PlayCircleOutlined />} 
              size="small" 
              onClick={() => handleOpenTest(record)}
              disabled={record.status !== 'indexed' || !record.is_configured}
            >
              {t("kb.tooltipTest")}
            </Button>
          </Tooltip>
          <Tooltip title={t("kb.delete")}>
            <Popconfirm
              title={t('kb.confirmDelete')}
              description={t('kb.deleteWarning')}
              onConfirm={() => handleDelete(record)}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
            >
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                size="small" 
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Render Test View
  if (view === 'test' && selectedDoc) {
    return (
      <div style={{ padding: 24, height: 'calc(100vh - 0px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setView('list')}>
              {t("kb.back")}
            </Button>
            <Title level={4} style={{ margin: 0 }}>{t("kb.tabTest")}: {selectedDoc.filename}</Title>
          </Space>
          <LanguageToggle />
        </div>

        <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
          {/* History Panel */}
          <Col span={8} style={{ height: '100%' }}>
            <Card title={t("kb.testHistory")} style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
               <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                 <List
                   dataSource={[...testHistory].reverse()}
                   renderItem={item => (
                     <List.Item 
                        onClick={() => setSelectedTest(item)}
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: selectedTest?.id === item.id ? 'rgba(0,0,0,0.02)' : undefined,
                          border: selectedTest?.id === item.id ? '1px solid #1890ff' : undefined,
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          display: 'block'
                        }}
                     >
                       <div style={{ textAlign: 'right', marginBottom: 8 }}>
                          <span style={{ background: '#1890ff', color: 'white', padding: '4px 8px', borderRadius: 12, fontSize: 12 }}>
                            {item.query}
                          </span>
                       </div>
                       <div>
                         <Space>
                           <CheckCircleOutlined style={{ color: '#52c41a' }} />
                           <Text type="secondary" style={{ fontSize: 12 }}>
                             {t("kb.testResults")} ({item.results?.length || 0})
                           </Text>
                         </Space>
                         <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                           {new Date(item.created_at).toLocaleTimeString()}
                         </div>
                       </div>
                     </List.Item>
                   )}
                 />
                 {testHistory.length === 0 && <Empty description={t("kb.testNoHistory")} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
               </div>
               <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
                 <Input.Search
                   placeholder={t("kb.testPlaceholder")}
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   onSearch={handleRecallTest}
                   enterButton={<Button icon={<SearchOutlined />} type="primary" disabled={testing} />}
                   loading={testing}
                 />
               </div>
            </Card>
          </Col>

          {/* Results Panel */}
          <Col span={16} style={{ height: '100%' }}>
            <Card title={t("kb.testDetails")} style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, overflowY: 'auto' }}>
               {selectedTest ? (
                 <Space orientation="vertical" style={{ width: '100%' }} size="large">
                   <div>
                     <Text type="secondary">{t("kb.testQuery")}</Text>
                     <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 4 }}>
                       {selectedTest.query}
                     </div>
                   </div>
                   
                   <div>
                     <Text type="secondary">{t("kb.testResults")}</Text>
                     {selectedTest.results?.map((result: any, i: number) => (
                        <Card key={i} size="small" style={{ marginTop: 8, borderLeft: '4px solid #1890ff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Badge count={`Score: ${(result.score * 100).toFixed(1)}%`} style={{ backgroundColor: '#52c41a' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>Chunk {result.chunk_index}</Text>
                          </div>
                          <Paragraph>
                            {result.content}
                          </Paragraph>
                          {result.metadata && (
                            <div style={{ background: '#fafafa', padding: 8, fontSize: 12, borderRadius: 4 }}>
                              <pre style={{ margin: 0 }}>{JSON.stringify(result.metadata, null, 2)}</pre>
                            </div>
                          )}
                        </Card>
                     ))}
                   </div>
                 </Space>
               ) : (
                 testHistory.length > 0 ? <Empty description={t("kb.testSelectPlaceholder")} /> : null
               )}
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // Render List View
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{t("kb.title")}</h1>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input.Search
              placeholder={t("kb.searchPlaceholder")}
              onSearch={(val) => {
                 setSearchQuery(val);
                 setPagination({ ...pagination, current: 1 });
                 fetchDocuments(1, val);
              }}
              style={{ width: 200 }}
              allowClear
            />

            <AntUpload
              showUploadList={false}
              beforeUpload={(file) => {
                handleUpload(file);
                return false; // Prevent auto upload
              }}
              accept=".txt,.pdf,.md,.docx,.xlsx,.pptx"
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                {uploading ? t("kb.uploading") : t("kb.upload")}
              </Button>
            </AntUpload>

            <Button
              onClick={() => fetchDocuments(pagination.current)}
              disabled={loading}
              icon={<ReloadOutlined spin={loading} />}
            >
              {t("kb.refresh")}
            </Button>

            <LanguageToggle />
          </div>
        </div>

        {uploading && (
          <div style={{ marginBottom: 16 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999', marginBottom: 4 }}>
               <span>{t("kb.uploadProgress")}</span>
               <span>{uploadProgress}%</span>
             </div>
             <Progress percent={uploadProgress} showInfo={false} size="small" />
          </div>
        )}

        <Card title={t("kb.listTitle") || "Documents"}>
          <AntUpload.Dragger
            showUploadList={false}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
            accept=".txt,.pdf,.md,.docx,.xlsx,.pptx"
            openFileDialogOnClick={false}
            style={{ padding: 0, border: 'none', background: 'transparent' }}
          >
            <Table
              dataSource={documents}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `${t("kb.totalDocs")}: ${total}`,
                onChange: (page, pageSize) => {
                   setPagination({ ...pagination, current: page, pageSize: pageSize });
                   fetchDocuments(page);
                }
              }}
              locale={{ emptyText: t("kb.noDocs") }}
            />
          </AntUpload.Dragger>
        </Card>
      </div>

      {/* RAG Config Modal */}
      <Modal
        title={t("kb.configTitle")}
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={handleSaveConfig}
        confirmLoading={savingConfig}
        width={600}
        maskClosable={false}
        okText={t("common.confirm")}
        cancelText={t("common.cancel")}
      >
        <Form
          form={configForm}
          layout="vertical"
          initialValues={ragConfig || {}}
        >
          <Row gutter={16}>
             <Col span={12}>
               <Form.Item name="index_mode" label={t("kb.cfgIndexMode")}>
                 <Select>
                   <Option value="auto">Auto</Option>
                   <Option value="manual">Manual</Option>
                 </Select>
               </Form.Item>
             </Col>
             <Col span={12}>
               <Form.Item name="retrieval_mode" label={t("kb.cfgRetrievalMode")}>
                 <Select>
                   <Option value="vector">Vector</Option>
                   <Option value="keyword">Keyword</Option>
                   <Option value="hybrid">Hybrid</Option>
                 </Select>
               </Form.Item>
             </Col>
          </Row>

          <Form.Item name="rerank_enabled" label={t("kb.cfgRerank")} valuePropName="checked">
             <Switch />
          </Form.Item>

          <Form.Item 
            noStyle
            shouldUpdate={(prev, current) => prev.rerank_enabled !== current.rerank_enabled}
          >
            {({ getFieldValue }) => 
              getFieldValue('rerank_enabled') && (
                <Form.Item name="rerank_model" label={t("kb.cfgRerankModel")}>
                   <Input />
                </Form.Item>
              )
            }
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.top_k !== curr.top_k}>
                {({ getFieldValue }) => (
                  <Form.Item name="top_k" label={`Top K: ${getFieldValue('top_k') || 5}`}>
                    <Slider min={1} max={20} />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.score_threshold !== curr.score_threshold}>
                {({ getFieldValue }) => (
                  <Form.Item name="score_threshold" label={`Threshold: ${getFieldValue('score_threshold') || 0.6}`}>
                    <Slider min={0} max={1} step={0.01} />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Index Modal */}
      <Modal
        title={t("kb.indexTitle")}
        open={indexModalOpen}
        onCancel={() => setIndexModalOpen(false)}
        onOk={handleIndex}
        confirmLoading={indexing}
        maskClosable={false}
        okText={t("common.confirm")}
        cancelText={t("common.cancel")}
      >
        <Form form={indexForm} layout="vertical">
          <Form.Item name="provider" label={t("kb.indexProvider")} rules={[{ required: true }]}>
            <Select onChange={handleIndexProviderChange} showSearch allowClear>
              {Object.entries(embeddingModelsConfig).map(([key, value]) => (
                <Option key={key} value={key}>{value.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item 
            noStyle
            shouldUpdate={(prev, current) => prev.provider !== current.provider}
          >
            {({ getFieldValue }) => {
               const provider = getFieldValue('provider');
               if (!provider) return null;

               const config = (embeddingModelsConfig as any)[provider];
               
               return (
                 <Form.Item name="model" label={t("kb.indexModel")} rules={[{ required: true }]}>
                   {provider === 'ollama' ? (
                     <Select showSearch allowClear placeholder="Select Ollama embedding model">
                       {ollamaModels.map(m => <Option key={m} value={m}>{m}</Option>)}
                     </Select>
                   ) : (
                     <Select showSearch allowClear placeholder="Select embedding model">
                       {config?.models.map((m: any) => (
                         <Option key={m.id} value={m.id}>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span>{m.id}</span>
                             <span style={{ fontSize: 11, color: '#999' }}>Dim: {m.dimension}</span>
                           </div>
                           <div style={{ fontSize: 10, color: '#999', marginTop: -4 }}>{m.description}</div>
                         </Option>
                       ))}
                     </Select>
                   )}
                 </Form.Item>
               );
            }}
          </Form.Item>

          <Form.Item name="language" label={t("kb.indexLanguage")} initialValue="zh">
            <Select>
              <Option value="zh">{t("common.lang.zh")}</Option>
              <Option value="en">{t("common.lang.en")}</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="chunk_size" label={t("kb.indexChunkSize")}>
                 <InputNumber style={{ width: '100%' }} min={1} placeholder="Default" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="chunk_overlap" label={t("kb.indexChunkOverlap")}>
                 <InputNumber style={{ width: '100%' }} min={0} placeholder="Default" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Preview Modal - Large size */}
      <Modal
        title={`${t("kb.preview")}: ${previewDoc?.filename}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width="66vw"
        style={{ top: 20 }}
        styles={{ body: { height: '85vh', padding: 0, overflow: 'hidden' } }}
        maskClosable={false}
      >
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
           {previewLoading ? (
             <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
               <Spin size="large" tip="Loading..." />
             </div>
           ) : previewObjectUrl ? (
             previewDoc?.filename.toLowerCase().endsWith('.pdf') ? (
               <iframe 
                 src={previewObjectUrl} 
                 style={{ width: '100%', height: '100%', border: 'none' }} 
                 title="PDF Preview"
               />
             ) : (['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => previewDoc?.filename.toLowerCase().endsWith('.' + ext))) ? (
                <div style={{ height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
                   <img src={previewObjectUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                </div>
             ) : (
               <div style={{ padding: 20, height: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                 {previewContent || "Preview not available for this file type."}
               </div>
             )
           ) : (
             <div style={{ padding: 20 }}>
               {previewContent}
             </div>
           )}
        </div>
      </Modal>
    </div>
  );
}
