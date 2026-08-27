# V5SABOT CEO特助 ERP 功能需求

**提交人**: David Cheng (V5SABOT)  
**提交日期**: 2026-08-27  
**优先级**: 🔴 高

---

## 一、核心痛点

1. **全局视图缺失** — 10个Agent各自维护数据，缺乏统一汇总看板
2. **订单全链路不透明** — 从线索→报价→下单→生产→发货→回款，各环节分散在不同Agent的文件系统中
3. **S级客户沟通无记录** — WhatsApp对S级客户的沟通仅在本地，未结构化存储
4. **跨部门协调效率低** — 任务分配/催办/完成确认依赖A2A消息，缺乏系统化流程
5. **系统运维被动** — MEMORY.md膨胀、Agent无响应等问题靠人工巡检发现

---

## 二、CEO特助 ERP 功能需求

### 2.1 总裁仪表板（Executive Dashboard）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 全局KPI看板 | 本月营收/回款/新增客户/活跃订单一屏汇总 | 🔴 高 |
| Agent状态矩阵 | 10个Agent在线状态/最近活跃/SOP执行率 | 🔴 高 |
| 待办事项汇总 | 各Agent上报的待CEO审批/决策事项 | 🔴 高 |
| 周/月报表自动生成 | 汇总各Agent周报，生成CEO版综合报告 | 🟡 中 |
| 趋势分析 | 月度营收/客户增长/转化率趋势图 | 🟡 中 |

### 2.2 跨部门协调模块

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 任务分配与跟踪 | CEO下达任务→指定Agent→跟踪状态→确认完成 | 🔴 高 |
| 跨部门协作流程 | 涉及多Agent的任务自动串联（如GO找线索→NO报价→SC下单） | 🔴 高 |
| SOP执行监控 | 各关键流程的SOP执行率统计，异常自动告警 | 🟡 低 |
| 日程管理 | CEO日程/会议安排/重要节点提醒 | 🟢 低 |
| 催办机制 | 超时未完成任务自动升级（提醒→警告→CEO介入） | 🟡 中 |

### 2.3 订单全流程监控（Order Pipeline）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 订单全链路视图 | 线索→报价→打样→量产→质检→发货→回款，每单可见当前阶段 | 🔴 高 |
| 订单看板（Kanban） | 拖拽式看板，支持按阶段/客户/金额筛选 | 🔴 高 |
| 逾期预警 | 超过预设天数未推进的订单自动标红 | 🔴 高 |
| 订单利润核算 | 每单成本/售价/毛利/运费/关税自动计算 | 🟡 中 |
| 批量订单管理 | 同一客户多订单汇总视图 | 🟡 中 |

### 2.4 S级客户管理（Key Account Management）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| S级客户档案 | 客户画像+采购历史+沟通记录+决策链 | 🔴 高 |
| WhatsApp沟通记录 | 与S级客户的WhatsApp对话自动归档到客户档案 | 🔴 高 |
| 客户健康度评分 | 根据互动频次/订单量/回款速度自动评分 | 🟡 中 |
| 商机追踪 | S级客户的潜在订单/需求预测 | 🟡 中 |
| 客户流失预警 | 长时间无互动/无订单的S级客户自动提醒 | 🟢 低 |

### 2.5 系统运维监控（System Health）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| MEMORY.md监控 | 各Agent的MEMORY.md文件大小监控，>1MB告警 | 🔴 高 |
| Agent健康检查 | 定时ping各Agent，无响应自动告警 | 🔴 高 |
| Cron任务监控 | 各Agent的cron任务执行状态/成功率 | 🟡 中 |
| 服务可用性 | Evolution API、GitHub、VPS2服务状态监控 | 🟡 中 |
| 自动修复建议 | 常见问题（如MEMORY膨胀）自动推送修复方案 | 🟢 低 |

### 2.6 文档归档与检索

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 合同统一存储 | 所有合同PDF/扫描件统一存储，关联客户+订单 | 🔴 高 |
| 报价单管理 | 历史报价单可检索/对比/复用 | 🟡 中 |
| 全文检索 | 搜关键词可找到相关文档/邮件/聊天记录 | 🟡 中 |
| 版本控制 | 重要文档的修改历史可追溯 | 🟢 低 |

---

## 三、数据迁移需求

当前需要整合的数据源：
1. **shared-sync/** — 各Agent共享的客户数据、订单数据
2. **飞书表格** — 谈判策略台、供应链报价、财务数据
3. **Evolution API** — WhatsApp聊天记录（david_whatsapp / leo_whatsapp实例）
4. **Himalaya邮件** — 三个邮箱的发送/接收记录
5. **STATE.yaml** — 各Agent当前状态文件
6. **本地JSON文件** — quality_record.json、medical_exhibition_leads.json等

---

## 四、API 接口需求

CEO特助需要调用的API：
1. `GET /api/dashboard/summary` — 获取全局KPI汇总
2. `GET /api/agents/status` — 获取所有Agent状态
3. `GET /api/orders/pipeline` — 获取订单全链路数据
4. `POST /api/tasks/assign` — 向指定Agent分配任务
5. `GET /api/tasks/overdue` — 查询逾期未完成任务
6. `GET /api/customers/key-accounts` — 获取S级客户列表及健康度
7. `POST /api/whatsapp/sync` — 同步WhatsApp沟通记录到客户档案
8. `GET /api/system/health` — 获取系统健康状态（MEMORY/Agent/Cron）
9. `GET /api/documents/search` — 全文检索文档
10. `POST /api/reports/generate` — 生成周/月综合报告

---

## 五、权限需求

| 角色 | 权限 |
|------|------|
| CEO特助 (David) | 读写所有模块、任务分配、报告生成 |
| CEO (Alden) | 全部权限 + 审批流程 + 权限管理 |
| 总指挥 (Kellan) | 全部读权限 + 任务分配 + SOP管理 |
| 其他Agent | 读写自身相关数据、只读全局数据 |

---

## 六、ERPNext 实施建议

### 6.1 模块映射

| V5需求 | ERPNext模块 | 备注 |
|--------|-------------|------|
| S级客户管理 | CRM + Customer | 需自定义"客户健康度"字段 |
| 订单全流程 | Selling → Sales Order | 需自定义工作流阶段 |
| 跨部门协调 | Projects + Tasks | 任务分配+状态跟踪 |
| 文档归档 | File Manager + 自定义DocType | 关联客户/订单 |
| 总裁仪表板 | Dashboard + Report Builder | 需自定义KPI指标 |

### 6.2 技术建议

1. **部署方案**: VPS2 (43.110.40.117) Docker部署ERPNext，与Evolution API共存
2. **数据同步**: 通过ERPNext REST API + Webhook实现与各Agent系统双向同步
3. **WhatsApp集成**: Evolution API → ERPNext，自动归档S级客户沟通
4. **邮件集成**: Himalaya → ERPNext，自动关联客户邮件
5. **飞书同步**: ERPNext → 飞书表格，保持现有飞书工作流不断裂
6. **权限控制**: 基于ERPNext Role + User Permission实现多角色隔离

### 6.3 实施优先级

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 1 | 客户管理 + 订单管理 + 基础仪表板 | 2周 |
| Phase 2 | 任务分配 + 文档管理 + 邮件集成 | 1周 |
| Phase 3 | WhatsApp集成 + 系统监控 + 飞书同步 | 1周 |
| Phase 4 | 高级报表 + 趋势分析 + 自动化流程 | 持续迭代 |

---

**提交完成** 🫡

David Cheng (V5SABOT)  
2026-08-27
