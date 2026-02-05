import React, { useState, useEffect } from 'react';
import { Select, Button, message, Space, Tag, Transfer, Divider, Tabs, Card, DatePicker, Row, Col, Modal, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import dayjs from 'dayjs';
import { useLocation } from "wouter";
import GeneralizedPairsManager from '../components/GeneralizedPairsManager';
import { ArrowLeftOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

interface TransferItem {
    key: string;
    title: string;
    description: string;
    session_name: string;
    session_id?: string;
    question: string;
    answer: string;
    timestamp: string;
    feedback: string | null;
    disabled?: boolean;
    hit_count?: number;
    hit_source?: string;
    intent?: string;
}

const BatchFeedback: React.FC = () => {
    const { t } = useTranslation();
    const [location, setLocation] = useLocation();
    
    // Parse query params
    const searchParams = new URLSearchParams(window.location.search);
    const repositoryId = searchParams.get('repoId') || undefined;

    const [activeTab, setActiveTab] = useState('review');

    // --- Feedback Review Logic ---
    const [loading, setLoading] = useState(false);
    const [dataSource, setDataSource] = useState<TransferItem[]>([]);
    const [targetKeys, setTargetKeys] = useState<React.Key[]>([]);
    
    // Filters
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
    const [marked, setMarked] = useState<boolean | null>(false); // Default to unmarked
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [sortBy, setSortBy] = useState<string | null>(null);
    const [hitSource, setHitSource] = useState<string | undefined>(undefined);

    const SYSTEM_PAIRS_SESSION_ID = 'system-pairs';

    // Edit Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<TransferItem | null>(null);
    const [editContent, setEditContent] = useState('');

    // Fetch sessions
    useEffect(() => {
        if (repositoryId) {
            api.sessions.list({ repository_id: repositoryId }).then(res => {
                const allSessions = [
                    { id: SYSTEM_PAIRS_SESSION_ID, name: t("feedback.tabGeneralized") || "Generalized Instruction Pairs" },
                    ...res
                ];
                setSessions(allSessions);
                
                if (allSessions.length > 0) {
                    setSelectedSessionIds([allSessions[1]?.id || allSessions[0].id]); 
                }
                setDateRange([dayjs().subtract(7, 'day'), dayjs()]);
            }).catch(err => console.error(err));
        }
    }, [repositoryId]);

    // Initial search when defaults are ready
    useEffect(() => {
        if (repositoryId && sessions.length > 0 && selectedSessionIds.length > 0 && dateRange && marked === false) {
             fetchFeedbackData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repositoryId, sessions]); 

    const fetchFeedbackData = async () => {
        setLoading(true);
        try {
            const params: any = { order };
            if (dateRange && dateRange[0] && dateRange[1]) {
                params.start_date = dateRange[0].toISOString();
                params.end_date = dateRange[1].toISOString();
            }
            if (marked !== null) {
                params.marked = marked;
            }
            if (sortBy) {
                params.sort_by = sortBy;
            }
            if (hitSource) {
                params.hit_source = hitSource;
            }
            
            let allItems: any[] = [];
            
            const hasSystem = selectedSessionIds.includes(SYSTEM_PAIRS_SESSION_ID);
            const userSessionIds = selectedSessionIds.filter(id => id !== SYSTEM_PAIRS_SESSION_ID);
            
            // 1. Fetch User Sessions
            if (userSessionIds.length > 0) {
                const userParams = { ...params, source: 'user', session_ids: userSessionIds };
                const userRes = await api.feedback.getInstructionPairs(userParams);
                allItems = [...allItems, ...userRes];
            }
            
            // 2. Fetch System Pairs (Generalized)
            if (hasSystem) {
                // If hitSource is selected (and not 'all'), we skip System Pairs because they don't have hit_source.
                // Or maybe we include them only if hitSource is undefined?
                // The backend implementation returns [] if hit_source is set.
                // So we can still call it, or skip it to save a request.
                if (!hitSource) {
                    const systemParams: any = { order: params.order, marked: params.marked, source: 'system' };
                    if (repositoryId) {
                        systemParams.repository_id = repositoryId;
                    }
                    if (sortBy) {
                        systemParams.sort_by = sortBy;
                    }
                    const systemRes = await api.feedback.getInstructionPairs(systemParams);
                    allItems = [...allItems, ...systemRes];
                }
            }

            const res = allItems;
            
            // Re-process for counts
            const grouped = new Map();
            res.forEach((item: any) => {
                const key = `${item.question?.trim()}|${item.answer?.trim()}`;
                if (!grouped.has(key)) {
                    grouped.set(key, { 
                        item: item, 
                        max_hit_count: 0,
                        local_count: 0
                    });
                }
                const group = grouped.get(key);
                
                // Increment local count (occurrences in the current list)
                group.local_count += 1;
                
                // We want to show the latest/max hit count from the backend
                // The backend returns the accumulated hit_count for the instruction (from Redis)
                // For LLM hits, backend hit_count is 0, so we use local_count.
                group.max_hit_count = Math.max(group.max_hit_count, item.hit_count || 0);
            });
            
            const uniqueRes = Array.from(grouped.values()).map((g: any) => {
                const item = g.item;
                // Use max of global hit count and local count
                item.hit_count = Math.max(g.max_hit_count, g.local_count);
                return item;
            });
            
            // Apply sorting again if needed (because we merged)
            if (sortBy === 'hit_count_asc') {
                uniqueRes.sort((a, b) => (a.hit_count || 0) - (b.hit_count || 0));
            } else if (sortBy === 'hit_count_desc') {
                uniqueRes.sort((a, b) => (b.hit_count || 0) - (a.hit_count || 0));
            }

            // Map to Transfer items
            const newItems = uniqueRes.map((item: any) => {
                const isInvalid = item.answer.includes("未找到匹配的指令") || item.answer.includes("当前会话未配置指令库");
                // If it is unmatched but we want to allow editing, we might not want to disable it entirely?
                // Actually, for "Transfer" (Batch Like), we should disable it until it's fixed.
                // But we need a way to edit it.
                
                return {
                    key: item.id,
                    title: item.question,
                    description: item.answer,
                    session_name: item.session_name,
                    session_id: item.session_id,
                    question: item.question,
                    answer: item.answer,
                    timestamp: item.timestamp,
                    feedback: item.feedback,
                    disabled: isInvalid, // Keep disabled for transfer, but we will add Edit button
                    hit_count: item.hit_count,
                    hit_source: item.hit_source,
                    intent: item.intent
                };
            });

            setDataSource((prev) => {
                const existingTargets = prev.filter(item => targetKeys.includes(item.key));
                const combined = [...existingTargets, ...newItems];
                const unique = Array.from(new Map(combined.map(item => [item.key, item])).values());
                return unique as TransferItem[];
            });

        } catch (error) {
            console.error("Failed to load instruction pairs", error);
            message.error(t("common.loadError") || "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchFeedbackData();
    };

    const handleSelectAllSessions = () => {
        const allIds = sessions.map(s => s.id);
        if (selectedSessionIds.length === allIds.length) {
            setSelectedSessionIds([]);
        } else {
            setSelectedSessionIds(allIds);
        }
    };

    const handleSaveFeedback = async () => {
        if (targetKeys.length === 0) return;
        
        // Validation: Check for Unmatched instructions
        const selectedItems = dataSource.filter(item => targetKeys.includes(item.key));
        const hasUnmatched = selectedItems.some(item => 
            item.answer && (item.answer.includes("未找到匹配的指令") || item.answer.includes("Unmatched Instruction"))
        );
        
        if (hasUnmatched) {
            Modal.error({
                title: t("feedback.validationError") || "Validation Error",
                content: (
                    <div>
                        <p>{t("feedback.unmatchedError") || "Selected items contain unmatched instructions."}</p>
                        <p>{t("feedback.unmatchedAction") || "Please go to 'Generalized Instruction Pairs' tab to resolve them first."}</p>
                    </div>
                )
            });
            return;
        }
        
        setLoading(true);
        try {
            // Check if we are deleting (right column and source is System Pairs or Marked User Pairs?)
            // The requirement says: "If selected to right side and they are Marked, it is Batch Delete"
            // Wait, standard behavior is: Right side = "To be Liked".
            // User requirement: "If marked... right side... batch delete".
            // So if `marked === true`, then the action is DELETE.
            // If `marked === false` (default), action is LIKE.
            
            const action = marked ? 'delete' : 'like';
            
            if (action === 'delete') {
                 // We need to know if it's from System or User. 
                 // The backend handles both if we send IDs. 
                 // But for User messages, delete might mean "delete message" or "delete feedback"? 
                 // Requirement says "Batch Delete". Assuming deleting the record or the feedback.
                 // For System Pairs, it deletes the BenchmarkCase.
                 // For User History, maybe delete the message? Or just clear feedback?
                 // Let's assume generic "delete" action to backend.
                 await api.feedback.batchGlobal(targetKeys, 'delete');
                 message.success(t("common.deleteSuccess") || "Deleted successfully");
            } else {
                 await api.feedback.batchGlobal(targetKeys, 'like');
                 message.success(t("feedback.saveSuccess"));
            }

            setTargetKeys([]);
            fetchFeedbackData();
        } catch (error) {
            console.error("Batch feedback failed", error);
            message.error(t("feedback.saveError"));
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: TransferItem) => {
        setEditingItem(item);
        setEditContent(item.answer);
        setIsEditModalVisible(true);
    };

    const handleEditSubmit = async () => {
        if (!editingItem) return;
        
        try {
            // Call API to update message content
            // We use editingItem.session_id which is now available in TransferItem
            
             await api.put(`/sessions/${editingItem.session_id}/messages/${editingItem.key}`, {
                content: editContent
            });
            
            message.success(t("common.updateSuccess") || "Updated successfully");
            setIsEditModalVisible(false);
            setEditingItem(null);
            fetchFeedbackData(); // Refresh to see changes
            
        } catch (error) {
            console.error("Update failed", error);
            message.error(t("common.updateError") || "Update failed");
        }
    };

    const filterOption = (inputValue: string, option: TransferItem) => {
        return option.question.indexOf(inputValue) > -1 || option.answer.indexOf(inputValue) > -1;
    };

    const handleChange = (newTargetKeys: React.Key[]) => {
        setTargetKeys(newTargetKeys);
    };

    // --- Render ---

    const items = [
        {
            key: 'review',
            label: t("feedback.tabReview") || "Feedback Review",
            children: (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                     <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                        <Select
                            mode="multiple"
                            style={{ width: 300 }}
                            placeholder={t("feedback.selectSession") || "Select Session"}
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            onChange={setSelectedSessionIds}
                            value={selectedSessionIds}
                            maxTagCount="responsive"
                            popupRender={(menu) => (
                                <>
                                    {menu}
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ padding: '0 8px 4px' }}>
                                        <Button type="text" block onClick={handleSelectAllSessions} size="small">
                                            {selectedSessionIds.length === sessions.length && sessions.length > 0
                                                ? (t("common.deselectAll") || "Deselect All")
                                                : (t("common.selectAll") || "Select All")}
                                        </Button>
                                    </div>
                                </>
                            )}
                        >
                            {sessions.map(s => (
                                <Option key={s.id} value={s.id}>{s.name}</Option>
                            ))}
                        </Select>
                        
                        <RangePicker 
                            showTime 
                            onChange={(dates) => setDateRange(dates as any)} 
                            value={dateRange}
                            style={{ width: 350 }}
                            allowClear
                        />
                        <Select 
                            value={order} 
                            onChange={setOrder} 
                            style={{ width: 120 }}
                            allowClear
                        >
                            <Option value="desc">{t("feedback.filterOrderDesc")}</Option>
                            <Option value="asc">{t("feedback.filterOrderAsc")}</Option>
                        </Select>
                         <Select 
                            value={marked} 
                            onChange={setMarked} 
                            style={{ width: 120 }} 
                            placeholder={t("feedback.filterMarked") || "Marked Status"}
                            allowClear
                        >
                            <Option value={false}>{t("feedback.filterMarkedNo") || "Unmarked"}</Option>
                            <Option value={true}>{t("feedback.filterMarkedYes") || "Marked"}</Option>
                        </Select>

                        {marked && (
                            <Select 
                                value={sortBy} 
                                onChange={setSortBy} 
                                style={{ width: 160 }} 
                                placeholder={t("feedback.sortByHits") || "Sort by Hits"}
                                allowClear
                            >
                                <Option value="hit_count_desc">{t("feedback.mostHits") || "Most Hits"}</Option>
                                <Option value="hit_count_asc">{t("feedback.fewestHits") || "Fewest Hits"}</Option>
                            </Select>
                        )}

                        <Select 
                            value={hitSource} 
                            onChange={setHitSource} 
                            style={{ width: 150 }} 
                            placeholder={t("feedback.filterSource") || "Source"}
                            allowClear
                        >
                            <Option value="llm">llm</Option>
                            <Option value="redis">redis</Option>
                            <Option value="memory">memory</Option>
                        </Select>

                        <Button type="primary" onClick={handleSearch} icon={<SyncOutlined />} loading={loading}>
                            {t("common.search") || "Search"}
                        </Button>
                    </Space>
                    
                    <Transfer
                        dataSource={dataSource}
                        titles={[t("common.searchResults") || "Search Results", t("common.selected") || "Selected"]}
                        targetKeys={targetKeys}
                        onChange={handleChange}
                        filterOption={filterOption}
                        showSearch
                        locale={{
                            itemUnit: t("common.item") || "item",
                            itemsUnit: t("common.items") || "items",
                            searchPlaceholder: t("common.search") || "Search",
                            notFoundContent: t("common.noData") || "No Data"
                        }}
                        render={(item) => {
                             return (
                                 <div style={{ marginBottom: 8, padding: 4, opacity: item.disabled ? 0.8 : 1, display: 'flex', justifyContent: 'space-between' }}>
                                     {/* Left Column: Q&A */}
                                     <div style={{ flex: 1, marginRight: 8, overflow: 'hidden' }}>
                                         <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                             {item.question}
                                         </div>
                                         <div style={{ color: '#666', fontSize: '12px' }}>
                                             <span style={{ 
                                                 whiteSpace: 'nowrap', 
                                                 overflow: 'hidden', 
                                                 textOverflow: 'ellipsis',
                                                 display: 'block'
                                             }}>
                                                 {item.answer}
                                             </span>
                                             <div style={{ marginTop: 4 }}>
                                                <Tag style={{ margin: 0 }}>{item.session_name}</Tag>
                                                {/* Edit Button */}
                                                {item.disabled && (
                                                    <Button 
                                                        type="link" 
                                                        size="small" 
                                                        icon={<EditOutlined />} 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(item);
                                                        }}
                                                    />
                                                )}
                                             </div>
                                         </div>
                                     </div>

                                     {/* Right Column: Metadata Stack (3 rows) */}
                                     <div style={{ width: 140, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', fontSize: 12, borderLeft: '1px solid #f0f0f0', paddingLeft: 8 }}>
                                         {/* Row 1: Source */}
                                         <div style={{ marginBottom: 4 }}>
                                           <Tag color={item.hit_source === 'redis' ? 'cyan' : (item.hit_source === 'memory' ? 'green' : 'blue')}>
                                               {t("feedback.source")}: {item.hit_source ? item.hit_source : (item.source === 'system' ? 'System' : 'llm')}
                                           </Tag>
                                       </div>
                                         {/* Row 2: Hits */}
                                         <div style={{ marginBottom: 4, fontWeight: 'bold', fontSize: 13 }}>
                                             Hits: {item.hit_count || 0}
                                         </div>
                                         {/* Row 3: Time */}
                                         <div style={{ color: '#999', fontSize: 11 }}>
                                             {dayjs(item.timestamp).format('MM-DD HH:mm')}
                                         </div>
                                     </div>
                                 </div>
                             );
                        }}
                        listStyle={{
                            width: '45%',
                            height: 600,
                        }}
                    />
                    
                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                         <Button 
                            type={marked ? "danger" : "primary"} 
                            onClick={handleSaveFeedback} 
                            loading={loading}
                            disabled={targetKeys.length === 0}
                            size="large"
                        >
                            {marked ? (t("common.batchDelete") || "Batch Delete") : (t("feedback.saveLike") || "Save to Batch")}
                        </Button>
                    </div>
                    
                    <Modal
                        title="Edit Instruction"
                        open={isEditModalVisible}
                        onOk={handleEditSubmit}
                        onCancel={() => setIsEditModalVisible(false)}
                        width={600}
                    >
                        <p>Question: {editingItem?.question}</p>
                        <TextArea 
                            rows={6} 
                            value={editContent} 
                            onChange={(e) => setEditContent(e.target.value)} 
                        />
                    </Modal>
                </div>
            )
        },
        {
            key: 'generalized',
            label: t("feedback.tabGeneralized") || "Generalized Instruction Pairs",
            children: <GeneralizedPairsManager repositoryId={repositoryId} />
        }
    ];

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => setLocation('/instruction-repos')}>
                    {t('repos.backToRepos') || "Back to Repos"}
                </Button>
            </div>
            <Card title={t("feedback.globalBatchTitle") || "Global Batch Feedback"}>
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} destroyOnHidden={true} />
            </Card>
        </div>
    );
};

export default BatchFeedback;
