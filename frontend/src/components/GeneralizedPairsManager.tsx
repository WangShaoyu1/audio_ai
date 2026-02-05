import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Modal, Form, Upload, message, Popconfirm, Select, Tooltip, InputNumber, Tag, Radio } from 'antd';
import { PlusOutlined, UploadOutlined, DownloadOutlined, FileExcelOutlined, InfoCircleOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

const { Option } = Select;

interface GeneralizedPairsManagerProps {
    repositoryId?: string;
}

const GeneralizedPairsManager: React.FC<GeneralizedPairsManagerProps> = ({ repositoryId }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [viewType, setViewType] = useState<'standard' | 'unmatched'>('standard');
    
    // Version control
    const [versions, setVersions] = useState<number[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
    const [activeVersion, setActiveVersion] = useState<number | null>(null);

    // Modal states
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form] = Form.useForm();

    // Generation Modal state
    const [isGenerateModalVisible, setIsGenerateModalVisible] = useState(false);
    const [generateForm] = Form.useForm();
    const [generating, setGenerating] = useState(false);

    const [repos, setRepos] = useState<any[]>([]);
    const [selectedRepoId, setSelectedRepoId] = useState<string | undefined>(repositoryId);

    const MODEL_OPTIONS = [
        { provider: 'qwen', models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-flash'] },
        { provider: 'minimax', models: ['abab6.5-chat', 'abab6.5s-chat', 'abab5.5-chat'] },
        { provider: 'qianfan', models: ['ERNIE-Bot-4', 'ERNIE-Bot-turbo'] },
        { provider: 'deepseek', models: ['deepseek-chat', 'deepseek-reasoner'] },
        { provider: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
    ];

    const fetchRepos = async () => {
        try {
            const res = await api.instructionRepos.list();
            setRepos(res);
        } catch (error) {
            console.error("Failed to fetch repos", error);
        }
    };

    const fetchVersions = async () => {
        if (!selectedRepoId) return;
        try {
            const [vers, activeRes] = await Promise.all([
                api.benchmark.versions(selectedRepoId),
                api.benchmark.getActiveVersion(selectedRepoId)
            ]);
            setVersions(vers || []);
            setActiveVersion(activeRes.active_version);
        } catch (error) {
            console.error("Failed to fetch versions", error);
        }
    };

    const handleApplyVersion = async () => {
        if (!selectedRepoId || !selectedVersion) return;
        try {
            await api.benchmark.applyVersion(selectedRepoId, selectedVersion);
            message.success(t('common.success') || 'Version applied successfully');
            fetchVersions(); // Refresh active version
        } catch (error) {
            message.error(t('common.error') || 'Failed to apply version');
        }
    };

    const fetchData = React.useCallback(async (page = 1, size = 10, keyword = '', currentViewType?: string) => {
        setLoading(true);
        const type = currentViewType || viewType;
        try {
            if (type === 'unmatched') {
                const feedbackParams: any = { 
                    unmatched: true,
                    source: 'user', 
                    page, 
                    size,
                    keyword 
                };
                // Only filter by repo if selected
                if (selectedRepoId) feedbackParams.repository_id = selectedRepoId;
                
                // Fetch unmatched instructions from Feedback API
                const allUnmatched = await api.feedback.getInstructionPairs(feedbackParams);
                
                // Client-side pagination
                const startIndex = (page - 1) * size;
                const endIndex = startIndex + size;
                const sliced = allUnmatched.slice(startIndex, endIndex);
                
                setData(sliced);
                setPagination(prev => ({ ...prev, current: page, pageSize: size, total: allUnmatched.length }));
            } else {
                const params: any = { page, size, keyword };
                if (selectedRepoId) {
                    params.repository_id = selectedRepoId;
                }
                if (selectedVersion) {
                    params.version = selectedVersion;
                }
                const res = await api.benchmark.list(params);
                setData(res.items);
                setPagination(prev => ({ ...prev, current: page, pageSize: size, total: res.total }));
            }
        } catch (error) {
            console.error(error);
            message.error(t('fetchFailed') || 'Fetch failed');
        } finally {
            setLoading(false);
        }
    }, [viewType, selectedRepoId, selectedVersion, t]);

    useEffect(() => {
        if (repositoryId) {
            setSelectedRepoId(repositoryId);
        }
    }, [repositoryId]);

    useEffect(() => {
        fetchRepos();
    }, []);

    useEffect(() => {
        // If viewType is unmatched, we don't strictly need a repo ID.
        // If viewType is standard, we need a repo ID for versions.
        if (selectedRepoId && viewType === 'standard') {
            fetchVersions();
        }
        
        // Trigger fetch with current viewType
        fetchData(1, pagination.pageSize, searchText, viewType);
        
    }, [selectedRepoId, selectedVersion, viewType, fetchData]);

    const handleGenerate = async (values: any) => {
        if (!selectedRepoId) return;
        setGenerating(true);
        try {
            const res = await api.benchmark.generate(selectedRepoId, values);
            message.success(res.message || t('generationSuccess'));
            setIsGenerateModalVisible(false);
            fetchVersions(); // Update versions list
            fetchData(1, pagination.pageSize, searchText);
        } catch (error: any) {
            message.error(error.response?.data?.detail || t('generationFailed'));
        } finally {
            setGenerating(false);
        }
    };

    const handleSearch = (value: string) => {
        setSearchText(value);
        fetchData(1, pagination.pageSize, value);
    };

    const handleTableChange = (newPagination: any) => {
        fetchData(newPagination.current, newPagination.pageSize, searchText);
    };

    const handleDelete = async (id: string) => {
        try {
            if (viewType === 'unmatched') {
                await api.feedback.batchGlobal([id], 'delete');
            } else {
                await api.benchmark.delete(id);
            }
            message.success(t('deleteSuccess') || 'Deleted successfully');
            fetchData(pagination.current, pagination.pageSize, searchText, viewType);
        } catch (error) {
            message.error(t('deleteFailed') || 'Delete failed');
        }
    };

    const handleSave = async (values: any) => {
        try {
            if (viewType === 'unmatched') {
                 // Editing an unmatched User Message -> Update the message content
                 if (!editingItem?.session_id) {
                     message.error("Missing session ID");
                     return;
                 }
                 
                 // Update Assistant Message (Answer)
                 await api.put(`/sessions/${editingItem.session_id}/messages/${editingItem.id}`, {
                    content: values.answer
                 });

                 // Update User Message (Question) if ID exists
                 if (editingItem.user_message_id) {
                     await api.put(`/sessions/${editingItem.session_id}/messages/${editingItem.user_message_id}`, {
                        content: values.question
                     });
                 }

                 message.success(t('updateSuccess') || 'Updated successfully');
            } else {
                // Standard Benchmark Item
                const payload = { ...values, repository_id: selectedRepoId, source: 'manual' };
                if (editingItem) {
                    await api.benchmark.update(editingItem.id, payload);
                    message.success(t('updateSuccess') || 'Updated successfully');
                } else {
                    await api.benchmark.create(payload);
                    message.success(t('createSuccess') || 'Created successfully');
                }
            }

            setIsModalVisible(false);
            form.resetFields();
            setEditingItem(null);
            fetchData(pagination.current, pagination.pageSize, searchText, viewType);
        } catch (error) {
            console.error(error);
            message.error(t('saveFailed') || 'Save failed');
        }
    };

    const handleImport = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedRepoId) {
            formData.append('repository_id', selectedRepoId);
        }
        try {
            await api.benchmark.import(formData);
            message.success(t('importSuccess') || 'Imported successfully');
            fetchData(pagination.current, pagination.pageSize, searchText, viewType);
        } catch (error) {
            message.error(t('importFailed') || 'Import failed');
        }
        return false; // Prevent default upload
    };

    const handleExport = async () => {
        try {
            const blob = await api.benchmark.export();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'system_instruction_pairs.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            message.error(t('exportFailed') || 'Export failed');
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const blob = await api.benchmark.template();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'template.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            message.error(t('downloadFailed') || 'Download failed');
        }
    };

    const columns = [
        {
            title: t('question') || 'Question',
            dataIndex: 'question',
            key: 'question',
            ellipsis: true,
        },
        {
            title: t('answer') || 'Answer',
            dataIndex: 'answer',
            key: 'answer',
            ellipsis: true,
        },
        {
            title: t('intent') || 'Intent',
            dataIndex: 'intent',
            key: 'intent',
            width: 150,
        },
        {
            title: t('feedback.version') || 'Version',
            key: 'version',
            width: 150,
            render: (_: any, record: any) => (
                <Tag color={record.source === 'system' ? (record.version === activeVersion ? 'purple' : 'blue') : 'green'}>
                    {record.source === 'system' ? `v${record.version}` : 'Manual'}
                    {record.source === 'system' && record.version === activeVersion ? ` (${t('feedback.active') || 'Active'})` : ''}
                </Tag>
            )
        },
        {
            title: t('action') || 'Action',
            key: 'action',
            width: 150,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <a onClick={() => {
                        setEditingItem(record);
                        form.setFieldsValue(record);
                        setIsModalVisible(true);
                    }}>{t('edit') || 'Edit'}</a>
                    <Popconfirm title={t('instructions.deleteConfirm') || "Are you sure?"} onConfirm={() => handleDelete(record.id)}>
                        <a style={{ color: 'red' }}>{t('common.delete') || 'Delete'}</a>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const [provider, setProvider] = useState('qwen');

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <Space>
                    {!repositoryId && (
                        <Select 
                            style={{ width: 180 }} 
                            placeholder={t('selectRepo')}
                            value={selectedRepoId}
                            onChange={setSelectedRepoId}
                            allowClear
                        >
                            {repos.map(repo => (
                                <Option key={repo.id} value={repo.id}>{repo.name}</Option>
                            ))}
                        </Select>
                    )}
                    
                    <Select
                        style={{ width: 180 }}
                        placeholder={t('feedback.allVersions') || "All Versions"}
                        value={selectedVersion}
                        onChange={setSelectedVersion}
                        allowClear
                        disabled={!selectedRepoId || viewType === 'unmatched'}
                    >
                         {versions.map(v => (
                             <Option key={v} value={v}>
                                v{v} {v === activeVersion ? `(${t('feedback.active') || 'Active'})` : ''}
                             </Option>
                         ))}
                    </Select>

                    <Radio.Group value={viewType} onChange={(e) => {
                        setViewType(e.target.value);
                        setPagination({ ...pagination, current: 1 });
                    }}>
                        <Radio.Button value="standard">{t("inst.standardPairs")}</Radio.Button>
                        <Radio.Button value="unmatched">{t("inst.unmatchedPairs") }</Radio.Button>
                    </Radio.Group>

                    {selectedVersion && selectedVersion !== activeVersion && (
                        <Button type="primary" onClick={handleApplyVersion}>
                            {t('feedback.applyVersion') || "Apply Version"}
                        </Button>
                    )}

                    <Input.Search
                        placeholder={t('searchPlaceholder') || "Search..."}
                        onSearch={handleSearch}
                        style={{ width: 200 }}
                        allowClear
                    />
                </Space>
                <Space>
                    {viewType === 'standard' && (
                        <>
                            <Tooltip title={
                                <div style={{ fontSize: 12 }}>
                                    <p>{t('inst.generationStrategy')}</p>
                                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                                        <li>{t('strategyTip1')}</li>
                                        <li>{t('strategyTip2')}</li>
                                        <li>{t('strategyTip3')}</li>
                                    </ul>
                                </div>
                            }>
                                <Button 
                                    type="primary" 
                                    onClick={() => {
                                        generateForm.setFieldsValue({ provider: 'qwen', model_name: 'qwen-plus', count_per_instr: 3 });
                                        setIsGenerateModalVisible(true);
                                    }}
                                    disabled={!selectedRepoId}
                                >
                                    {t('generatePairs')} <InfoCircleOutlined />
                                </Button>
                            </Tooltip>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                                {t('template') || 'Template'}
                            </Button>
                            <Upload
                                beforeUpload={handleImport}
                                showUploadList={false}
                                accept=".xlsx,.xls"
                            >
                                <Button icon={<UploadOutlined />}>
                                    {t('import') || 'Import'}
                                </Button>
                            </Upload>
                            <Button icon={<FileExcelOutlined />} onClick={handleExport}>
                                {t('export') || 'Export'}
                            </Button>
                            <Button type="default" icon={<PlusOutlined />} onClick={() => {
                                setEditingItem(null);
                                form.resetFields();
                                setIsModalVisible(true);
                            }} disabled={!selectedRepoId}>
                                {t('add') || 'Add'}
                            </Button>
                        </>
                    )}
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                pagination={{
                    ...pagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => t('common.totalItems', { total }) || `Total ${total} items`,
                }}
                loading={loading}
                onChange={handleTableChange}
                size="small"
                locale={{ emptyText: t('common.noData') || 'No Data' }}
            />

            <Modal
                title={editingItem ? (t('editPair') || 'Edit Pair') : (t('addPair') || 'Add Pair')}
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => setIsModalVisible(false)}
                maskClosable={false}
                centered
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="question" label={t('question') || 'Question'} rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="answer" label={t('answer') || 'Answer'} rules={[{ required: true }]}>
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item name="intent" label={t('intent') || 'Intent'} initialValue="instruction">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('feedback.generateConfigTitle') || "Generation Configuration"}
                open={isGenerateModalVisible}
                onOk={() => generateForm.submit()}
                onCancel={() => setIsGenerateModalVisible(false)}
                maskClosable={false}
                confirmLoading={generating}
                centered
            >
                <Form 
                    form={generateForm} 
                    layout="vertical" 
                    onFinish={handleGenerate}
                    initialValues={{ provider: 'qwen', model_name: 'qwen-plus', count_per_instr: 5 }}
                >
                    <Form.Item 
                        name="provider" 
                        label={t('feedback.provider') || "Provider"} 
                        rules={[{ required: true }]}
                    >
                        <Select onChange={setProvider}>
                            {MODEL_OPTIONS.map(opt => (
                                <Option key={opt.provider} value={opt.provider}>{opt.provider.toUpperCase()}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item 
                        name="model_name" 
                        label={t('feedback.model') || "Model"} 
                        rules={[{ required: true }]}
                    >
                        <Select>
                            {MODEL_OPTIONS.find(opt => opt.provider === provider)?.models.map(model => (
                                <Option key={model} value={model}>{model}</Option>
                            )) || []}
                        </Select>
                    </Form.Item>
                    <Form.Item 
                        name="count_per_instr" 
                        label={t('feedback.countPerInstr') || "Count Per Instruction"} 
                        rules={[{ required: true, type: 'number', min: 1, max: 50 }]}
                    >
                        <InputNumber min={1} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default GeneralizedPairsManager;
