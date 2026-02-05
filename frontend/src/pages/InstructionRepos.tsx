import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Input, Table, Modal, message, Select, Space } from "antd";
import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, ToolOutlined, AuditOutlined } from "@ant-design/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import { api } from "@/lib/api";
import { useLocation } from "wouter";

const { TextArea } = Input;
const { Option } = Select;

interface InstructionRepo {
  id: string;
  name: string;
  device_type: string;
  language: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function InstructionRepos() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [repos, setRepos] = useState<InstructionRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<InstructionRepo | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    device_type: "",
    language: "zh",
    description: ""
  });

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const data = await api.instructionRepos.list();
      setRepos(data);
    } catch (error) {
      message.error(t("repos.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.device_type) {
        message.error(t("common.error")); // Basic validation
        return;
    }

    try {
      if (editingRepo) {
        await api.instructionRepos.update(editingRepo.id, formData);
        message.success(t("repos.updateSuccess"));
      } else {
        await api.instructionRepos.create(formData);
        message.success(t("repos.createSuccess"));
      }
      setOpen(false);
      setEditingRepo(null);
      setFormData({ name: "", device_type: "", language: "zh", description: "" });
      fetchRepos();
    } catch (error) {
      message.error(editingRepo ? t("repos.updateError") : t("repos.createError"));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t("common.delete"),
      content: t("repos.deleteConfirm"),
      okText: t("common.confirm"),
      cancelText: t("common.cancel"),
      okType: 'danger',
      maskClosable: false,
      onOk: async () => {
        try {
          await api.instructionRepos.delete(id);
          message.success(t("repos.deleteSuccess"));
          fetchRepos();
        } catch (error) {
          message.error(t("repos.deleteError"));
        }
      }
    });
  };

  const openEditModal = (repo: InstructionRepo) => {
    setEditingRepo(repo);
    setFormData({
      name: repo.name,
      device_type: repo.device_type,
      language: repo.language,
      description: repo.description
    });
    setOpen(true);
  };

  const openCreateModal = () => {
    setEditingRepo(null);
    setFormData({ name: "", device_type: "", language: "zh", description: "" });
    setOpen(true);
  };

  const columns = [
    {
      title: t("repos.colName"),
      dataIndex: 'name',
      key: 'name',
    },
    {
        title: t("repos.colDevice"),
        dataIndex: 'device_type',
        key: 'device_type',
    },
    {
        title: t("repos.colLang"),
        dataIndex: 'language',
        key: 'language',
        render: (text: string) => text === 'zh' ? '中文' : 'English',
    },
    {
      title: t("repos.colDesc"),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t("repos.colActions"),
      key: 'actions',
      width: 350,
      render: (_: any, record: InstructionRepo) => (
        <Space>
            <Button
                type="primary"
                icon={<ToolOutlined />}
                size="small"
                onClick={() => setLocation(`/instructions?repoId=${record.id}`)}
            >
                {t("repos.manageInstructions")}
            </Button>
            <Button
                icon={<AuditOutlined />}
                size="small"
                onClick={() => setLocation(`/batch-feedback?repoId=${record.id}`)}
            >
                {t("feedback.batchGlobal") || "Batch Feedback"}
            </Button>
            <Button 
                type="default" 
                icon={<EditOutlined />} 
                size="small"
                onClick={() => openEditModal(record)}
            />
            <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
                onClick={() => handleDelete(record.id)}
            />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{t("repos.title")}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button onClick={fetchRepos} disabled={loading} icon={<ReloadOutlined spin={loading} />}>
              {t("kb.refresh")}
            </Button>
            
            <Button type="primary" onClick={openCreateModal} icon={<PlusOutlined />}>
              {t("repos.createBtn")}
            </Button>
            
            <LanguageToggle />
          </div>
        </div>

        <Card title={t("repos.listTitle")}>
          <Table
            dataSource={repos}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: t("repos.noData") }}
          />
        </Card>

        <Modal
          title={editingRepo ? t("repos.updateDialogTitle") : t("repos.createDialogTitle")}
          open={open}
          maskClosable={false}
          onCancel={() => setOpen(false)}
          onOk={handleCreateOrUpdate}
          okText={t("common.confirm")}
          cancelText={t("common.cancel")}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
            <div>
              <div style={{ marginBottom: 8 }}>{t("repos.labelName")}</div>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("repos.placeholderName")}
              />
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>{t("repos.labelDevice")}</div>
              <Input
                value={formData.device_type}
                onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                placeholder={t("repos.placeholderDevice")}
              />
            </div>
            <div>
                <div style={{ marginBottom: 8 }}>{t("repos.labelLang")}</div>
                <Select
                    value={formData.language}
                    onChange={(value) => setFormData({ ...formData, language: value })}
                    style={{ width: '100%' }}
                >
                    <Option value="zh">{t("common.lang.zh")}</Option>
                    <Option value="en">{t("common.lang.en")}</Option>
                </Select>
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>{t("repos.labelDesc")}</div>
              <TextArea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("repos.placeholderDesc")}
                rows={4}
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
