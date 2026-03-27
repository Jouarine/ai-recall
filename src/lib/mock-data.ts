import type { Material, ClozeQuestion, ShortAnswerQuestion, ErrorRecord, ChatMessage } from '@/types';

// ===== 章节树 Mock =====
export const mockMaterial: Material = {
  id: 'mat-1',
  title: '计算机网络基础',
  createdAt: '2026-03-20',
  chapters: [
    {
      id: 'ch-1',
      name: '第一章 计算机网络概述',
      materialId: 'mat-1',
      completedCount: 8,
      totalCount: 12,
      children: [
        { id: 'kp-1-1', name: '1.1 计算机网络的定义与分类', chapterId: 'ch-1', content: '计算机网络是指将地理位置不同的具有独立功能的多台计算机及其外部设备，通过通信线路和通信设备连接起来，在网络操作系统、网络管理软件及网络通信协议的管理和协调下，实现资源共享和信息传递的计算机系统。按覆盖范围分为：局域网（LAN）、城域网（MAN）、广域网（WAN）。', completedCount: 4, totalCount: 4 },
        { id: 'kp-1-2', name: '1.2 网络体系结构与协议', chapterId: 'ch-1', content: 'OSI参考模型将网络通信分为七层：物理层、数据链路层、网络层、传输层、会话层、表示层和应用层。TCP/IP模型则简化为四层：网络接口层、网际层、传输层和应用层。协议是网络中通信双方必须遵循的规则和约定。', completedCount: 3, totalCount: 4 },
        { id: 'kp-1-3', name: '1.3 网络拓扑结构', chapterId: 'ch-1', content: '常见的网络拓扑结构包括：星型拓扑（所有节点连接到中心节点）、总线型拓扑（所有节点共享一条传输介质）、环型拓扑（节点首尾相连形成闭合环路）和网状拓扑（节点之间有多条路径）。星型拓扑是目前最常用的局域网拓扑结构。', completedCount: 1, totalCount: 4 },
      ],
    },
    {
      id: 'ch-2',
      name: '第二章 数据通信基础',
      materialId: 'mat-1',
      completedCount: 3,
      totalCount: 15,
      children: [
        { id: 'kp-2-1', name: '2.1 数据通信的基本概念', chapterId: 'ch-2', content: '数据通信是指按照通信协议，利用数据传输技术在两个功能单元之间传递数据信息的过程。基本概念包括：信源（数据发送方）、信宿（数据接收方）、信道（数据传输通道）。数据传输方式分为并行传输和串行传输。', completedCount: 2, totalCount: 3 },
        { id: 'kp-2-2', name: '2.2 编码与调制技术', chapterId: 'ch-2', content: '数字数据的数字信号编码方法包括：非归零编码（NRZ）、曼彻斯特编码和差分曼彻斯特编码。曼彻斯特编码的特点是每个比特周期中间都有一次电平跳变，既可以表示数据，又可以作为时钟同步信号。', completedCount: 1, totalCount: 3 },
        { id: 'kp-2-3', name: '2.3 数据交换技术', chapterId: 'ch-2', content: '数据交换技术包括电路交换、报文交换和分组交换。分组交换又分为数据报方式和虚电路方式。分组交换是现代计算机网络最常用的交换技术，它将数据分成较小的分组进行传输，具有高效、灵活、可靠的特点。', completedCount: 0, totalCount: 3 },
        { id: 'kp-2-4', name: '2.4 多路复用技术', chapterId: 'ch-2', content: '多路复用技术允许多个信号在同一条物理线路上同时传输。常见的多路复用方式：频分多路复用（FDM）、时分多路复用（TDM）、波分多路复用（WDM）和码分多路复用（CDM/CDMA）。', completedCount: 0, totalCount: 3 },
        { id: 'kp-2-5', name: '2.5 差错控制', chapterId: 'ch-2', content: '差错控制的目的是发现和纠正传输过程中的错误。主要方法包括：奇偶校验、循环冗余校验（CRC）和海明码。CRC广泛用于数据链路层的差错检测，海明码可以实现纠错功能。', completedCount: 0, totalCount: 3 },
      ],
    },
    {
      id: 'ch-3',
      name: '第三章 网络层与路由',
      materialId: 'mat-1',
      completedCount: 0,
      totalCount: 12,
      children: [
        { id: 'kp-3-1', name: '3.1 IP协议与地址', chapterId: 'ch-3', content: 'IP协议是TCP/IP协议栈中网络层的核心协议。IPv4地址长度为32位，通常用点分十进制表示。IP地址分为A、B、C、D、E五类。子网掩码用于区分IP地址中的网络号和主机号。CIDR（无类别域间路由）采用"地址/前缀长度"的记法。', completedCount: 0, totalCount: 4 },
        { id: 'kp-3-2', name: '3.2 路由算法与协议', chapterId: 'ch-3', content: '路由算法分为静态路由和动态路由。动态路由协议包括：RIP（基于距离向量算法，最大跳数15）、OSPF（基于链路状态算法，使用Dijkstra最短路径算法）和BGP（边界网关协议，用于自治系统间的路由选择）。', completedCount: 0, totalCount: 4 },
        { id: 'kp-3-3', name: '3.3 ICMP与ARP协议', chapterId: 'ch-3', content: 'ICMP（Internet控制消息协议）用于在网络中传递控制消息和错误报告，ping命令就是基于ICMP协议实现的。ARP（地址解析协议）用于将IP地址解析为MAC地址，工作在数据链路层和网络层之间。', completedCount: 0, totalCount: 4 },
      ],
    },
    {
      id: 'ch-4',
      name: '第四章 传输层协议',
      materialId: 'mat-1',
      completedCount: 0,
      totalCount: 10,
      children: [
        { id: 'kp-4-1', name: '4.1 TCP协议', chapterId: 'ch-4', content: 'TCP是一种面向连接的、可靠的传输层协议。TCP通过三次握手建立连接，四次挥手释放连接。TCP提供流量控制（滑动窗口机制）和拥塞控制（慢开始、拥塞避免、快重传、快恢复）机制。', completedCount: 0, totalCount: 5 },
        { id: 'kp-4-2', name: '4.2 UDP协议', chapterId: 'ch-4', content: 'UDP是一种无连接的、不可靠的传输层协议。UDP不保证数据的可靠交付，但传输速度快、开销小。UDP适用于实时应用如视频通话、在线游戏等场景。UDP数据报的首部只有8个字节。', completedCount: 0, totalCount: 5 },
      ],
    },
  ],
};

// ===== 填空题 Mock =====
export const mockClozeQuestions: ClozeQuestion[] = [
  {
    id: 'cq-1',
    type: 'cloze',
    knowledgePointId: 'kp-1-1',
    originalText: '计算机网络是指将地理位置不同的具有独立功能的多台计算机及其外部设备，通过通信线路和通信设备连接起来，在网络操作系统、网络管理软件及网络通信协议的管理和协调下，实现资源共享和信息传递的计算机系统。',
    displayText: '计算机网络是指将地理位置不同的具有独立功能的多台计算机及其外部设备，通过{{blank_0}}和{{blank_1}}连接起来，在网络操作系统、网络管理软件及网络通信协议的管理和协调下，实现{{blank_2}}和{{blank_3}}的计算机系统。',
    blanks: [
      { id: 'b-1', answer: '通信线路', index: 0 },
      { id: 'b-2', answer: '通信设备', index: 1 },
      { id: 'b-3', answer: '资源共享', index: 2 },
      { id: 'b-4', answer: '信息传递', index: 3 },
    ],
    isStarred: false,
  },
  {
    id: 'cq-2',
    type: 'cloze',
    knowledgePointId: 'kp-1-2',
    originalText: 'OSI参考模型将网络通信分为七层：物理层、数据链路层、网络层、传输层、会话层、表示层和应用层。',
    displayText: 'OSI参考模型将网络通信分为{{blank_0}}层：{{blank_1}}、数据链路层、{{blank_2}}、传输层、会话层、表示层和{{blank_3}}。',
    blanks: [
      { id: 'b-5', answer: '七', index: 0 },
      { id: 'b-6', answer: '物理层', index: 1 },
      { id: 'b-7', answer: '网络层', index: 2 },
      { id: 'b-8', answer: '应用层', index: 3 },
    ],
    isStarred: true,
  },
  {
    id: 'cq-3',
    type: 'cloze',
    knowledgePointId: 'kp-1-3',
    originalText: '常见的网络拓扑结构包括：星型拓扑、总线型拓扑、环型拓扑和网状拓扑。星型拓扑是目前最常用的局域网拓扑结构。',
    displayText: '常见的网络拓扑结构包括：{{blank_0}}、总线型拓扑、{{blank_1}}和网状拓扑。{{blank_2}}是目前最常用的局域网拓扑结构。',
    blanks: [
      { id: 'b-9', answer: '星型拓扑', index: 0 },
      { id: 'b-10', answer: '环型拓扑', index: 1 },
      { id: 'b-11', answer: '星型拓扑', index: 2 },
    ],
    isStarred: false,
  },
];

// ===== 简答题 Mock =====
export const mockShortAnswerQuestions: ShortAnswerQuestion[] = [
  {
    id: 'sq-1',
    type: 'short_answer',
    knowledgePointId: 'kp-1-2',
    question: '请简述 TCP/IP 四层模型的各层名称及其主要功能。',
    referenceAnswer: 'TCP/IP模型分为四层：1.网络接口层：负责与物理网络的接口；2.网际层(IP层)：负责数据包的路由和转发；3.传输层：提供端到端的通信服务(TCP/UDP)；4.应用层：提供用户应用程序的网络服务。',
    isStarred: false,
  },
  {
    id: 'sq-2',
    type: 'short_answer',
    knowledgePointId: 'kp-2-2',
    question: '请说明曼彻斯特编码的特点以及它相比于非归零编码的优势。',
    referenceAnswer: '曼彻斯特编码的特点是每个比特周期的中间都有一次电平跳变。其优势在于：1.自同步特性，接收方可从信号中提取时钟信息；2.无直流分量，不会因基线漂移导致误判。相比NRZ编码不需要额外的时钟线路。',
    isStarred: true,
  },
];

// ===== 错题 Mock =====
export const mockErrorRecords: ErrorRecord[] = [
  {
    id: 'err-1',
    questionId: 'cq-1',
    question: mockClozeQuestions[0],
    chapterName: '第一章 计算机网络概述',
    knowledgePointName: '1.1 计算机网络的定义与分类',
    errorCount: 3,
    lastErrorAt: '2026-03-24 14:30',
    resolved: false,
  },
  {
    id: 'err-2',
    questionId: 'sq-1',
    question: mockShortAnswerQuestions[0],
    chapterName: '第一章 计算机网络概述',
    knowledgePointName: '1.2 网络体系结构与协议',
    errorCount: 1,
    lastErrorAt: '2026-03-23 20:15',
    resolved: false,
  },
  {
    id: 'err-3',
    questionId: 'cq-2',
    question: mockClozeQuestions[1],
    chapterName: '第一章 计算机网络概述',
    knowledgePointName: '1.2 网络体系结构与协议',
    errorCount: 2,
    lastErrorAt: '2026-03-22 16:45',
    resolved: true,
  },
];

// ===== 聊天 Mock =====
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: '你好！我是你的 AI 学习导师。当前知识点是「计算机网络的定义与分类」。有什么不理解的地方可以问我哦！',
    timestamp: '2026-03-25 18:00',
  },
  {
    id: 'msg-2',
    role: 'user',
    content: '局域网和广域网的主要区别是什么？',
    timestamp: '2026-03-25 18:01',
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content: '好问题！局域网（LAN）和广域网（WAN）的主要区别在于：\n\n1. **覆盖范围**：LAN 通常覆盖一栋建筑或一个校园（几百米到几公里），WAN 则覆盖城市、国家甚至全球。\n\n2. **传输速率**：LAN 传输速率通常较高（100Mbps~10Gbps），WAN 相对较低。\n\n3. **拥有者**：LAN 通常由单个组织拥有和管理，WAN 通常需要租用电信运营商的线路。\n\n4. **典型例子**：公司办公网络是 LAN，互联网本身就是最大的 WAN。\n\n需要我举个更具体的例子吗？',
    timestamp: '2026-03-25 18:01',
  },
];

// ===== 合并题目列表 =====
export const mockQuestions = [...mockClozeQuestions, ...mockShortAnswerQuestions];
